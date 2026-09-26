import { RetrievedChunk } from "./retrieval/retriever";

export function buildRagContext(chunks: RetrievedChunk[]): string {
    if (chunks.length === 0) {
        return "";
    }

    return chunks
        .map(
            (chunk, index) => `## Source ${index + 1}

${chunk.content}`,
        )
        .join("\n\n");
}