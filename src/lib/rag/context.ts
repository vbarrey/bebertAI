import { RetrievedChunk } from "./retrieval/retriever";

// Shorter matches between two chunks are likely coincidental, not the chunker overlap.
const MIN_OVERLAP = 20;

const EXCERPTS_INSTRUCTIONS = `Contexte documentaire : extraits des documents de l'utilisateur, du plus au moins pertinent.
Ce sont des passages partiels de documents plus longs : la fin d'un extrait n'est pas la fin du document.
Ne dis jamais que la documentation s'interrompt ou que tu n'as pas accès à la suite. Si l'information semble incomplète, réponds avec ce qui est disponible et indique le document et la page où chercher la suite.`;

export type Excerpt = {
    documentId: string;
    documentName: string;
    // Best search result of the excerpt: the chunk a source link points to.
    chunkId: string;
    chunkPage: number | null;
    firstPage: number | null;
    lastPage: number | null;
    lastPosition: number;
    text: string;
    score: number;
};

/**
 * Joins two consecutive chunks of the same page, dropping the text repeated by the chunker overlap.
 */
export function joinChunks(previous: string, next: string): string {
    for (let size = Math.min(previous.length, next.length); size >= MIN_OVERLAP; size--) {
        if (previous.endsWith(next.slice(0, size))) {
            return previous + next.slice(size);
        }
    }

    return `${previous}\n${next}`;
}

function pagesLabel({ firstPage, lastPage }: Excerpt): string {
    if (firstPage === null) {
        return "";
    }

    return firstPage === lastPage ? `, page ${firstPage}` : `, pages ${firstPage} à ${lastPage}`;
}

/**
 * Consecutive chunks of a document become one excerpt, so the model reads continuous text instead of fragments.
 * Excerpts are sorted from the most to the least relevant.
 */
export function buildExcerpts(chunks: RetrievedChunk[]): Excerpt[] {
    const sorted = [...chunks].sort((a, b) =>
        a.documentId.localeCompare(b.documentId) || a.position - b.position,
    );

    const excerpts: Excerpt[] = [];
    // Neighbours share the score of their result: only search results can become the excerpt target.
    const targetScores = new Map<Excerpt, number>();

    const setTarget = (excerpt: Excerpt, chunk: RetrievedChunk) => {
        if (chunk.hit && chunk.score > (targetScores.get(excerpt) ?? -1)) {
            excerpt.chunkId = chunk.chunkId;
            excerpt.chunkPage = chunk.pageNumber;
            targetScores.set(excerpt, chunk.score);
        }
    };

    for (const chunk of sorted) {
        const last = excerpts.at(-1);

        if (last?.documentId === chunk.documentId && last.lastPosition + 1 === chunk.position) {
            // Chunks never overlap across pages: the chunker splits page by page.
            last.text = last.lastPage === chunk.pageNumber
                ? joinChunks(last.text, chunk.content)
                : `${last.text}\n\n${chunk.content}`;
            last.lastPage = chunk.pageNumber;
            last.lastPosition = chunk.position;
            last.score = Math.max(last.score, chunk.score);
            setTarget(last, chunk);
        } else {
            const excerpt: Excerpt = {
                documentId: chunk.documentId,
                documentName: chunk.documentName,
                chunkId: chunk.chunkId,
                chunkPage: chunk.pageNumber,
                firstPage: chunk.pageNumber,
                lastPage: chunk.pageNumber,
                lastPosition: chunk.position,
                text: chunk.content,
                score: chunk.score,
            };

            excerpts.push(excerpt);
            setTarget(excerpt, chunk);
        }
    }

    return excerpts.sort((a, b) => b.score - a.score);
}

export function buildRagContext(excerpts: Excerpt[]): string {
    if (excerpts.length === 0) {
        return "";
    }

    return [
        EXCERPTS_INSTRUCTIONS,
        ...excerpts
            .map((excerpt, index) =>
                `### Extrait ${index + 1} — ${excerpt.documentName}${pagesLabel(excerpt)}\n\n${excerpt.text}`,
            ),
    ].join("\n\n");
}
