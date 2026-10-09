import { RetrievedChunk } from "./retrieval/retriever";

// Shorter matches between two chunks are likely coincidental, not the chunker overlap.
const MIN_OVERLAP = 20;

const EXCERPTS_INSTRUCTIONS = `Contexte documentaire : extraits des documents de l'utilisateur, du plus au moins pertinent.
Ce sont des passages partiels de documents plus longs : la fin d'un extrait n'est pas la fin du document.
Ne dis jamais que la documentation s'interrompt ou que tu n'as pas accès à la suite. Si l'information semble incomplète, réponds avec ce qui est disponible et indique le document et la page où chercher la suite.`;

type Excerpt = {
    documentId: string;
    documentName: string;
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
 */
export function buildRagContext(chunks: RetrievedChunk[]): string {
    if (chunks.length === 0) {
        return "";
    }

    const sorted = [...chunks].sort((a, b) =>
        a.documentId.localeCompare(b.documentId) || a.position - b.position,
    );

    const excerpts: Excerpt[] = [];

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
        } else {
            excerpts.push({
                documentId: chunk.documentId,
                documentName: chunk.documentName,
                firstPage: chunk.pageNumber,
                lastPage: chunk.pageNumber,
                lastPosition: chunk.position,
                text: chunk.content,
                score: chunk.score,
            });
        }
    }

    return [
        EXCERPTS_INSTRUCTIONS,
        ...excerpts
            .sort((a, b) => b.score - a.score)
            .map((excerpt, index) =>
                `### Extrait ${index + 1} — ${excerpt.documentName}${pagesLabel(excerpt)}\n\n${excerpt.text}`,
            ),
    ].join("\n\n");
}
