import { AIProviderClient } from "@/lib/ai/provider";
import { qdrant } from "@/lib/qdrant/client";
import { CHUNKS_COLLECTION } from "@/lib/qdrant/collections";
import { getChunksByIds, getChunksInRanges } from "@/lib/queries/chunk";

export type RetrievedChunk = {
    chunkId: string;
    documentId: string;
    documentName: string;
    position: number;
    pageNumber: number | null;
    content: string;
    // Neighbours take the score of the best result they surround.
    score: number;
};

export type RetrievalOptions = {
    limit?: number;
    scoreThreshold?: number;
    neighborChunks?: number;
};

type PointPayload = {
    chunkId: string;
    documentId: string;
};

export class DocumentRetriever {
    constructor(
        private readonly embeddingProvider: AIProviderClient,
        private readonly embeddingModelName: string,
    ) { }

    async retrieve(
        query: string,
        options: RetrievalOptions = {},
    ): Promise<RetrievedChunk[]> {
        const {
            limit = 20,
            scoreThreshold = 0.55,
            neighborChunks = 0,
        } = options;

        const embeddings = await this.embeddingProvider.embed({
            model: this.embeddingModelName,
            input: [query],
        });

        const queryEmbedding = embeddings[0];

        if (!queryEmbedding) {
            throw new Error(
                "No embedding was generated for the retrieval query",
            );
        }

        const results = await qdrant.query(
            CHUNKS_COLLECTION,
            {
                query: queryEmbedding,
                limit,
                with_payload: true,
            },
        );

        const scoreById = new Map(
            results.points
                .filter((point) => point.score >= scoreThreshold)
                .map((point) => [(point.payload as PointPayload).chunkId, point.score]),
        );

        // Points whose chunk no longer exists in the database are dropped here.
        const hits = await getChunksByIds([...scoreById.keys()]);

        if (hits.length === 0) {
            return [];
        }

        const chunks = await getChunksInRanges(
            hits.map((hit) => ({
                documentId: hit.documentId,
                from: hit.position - neighborChunks,
                to: hit.position + neighborChunks,
            })),
        );

        return chunks.map((chunk) => ({
            chunkId: chunk.id,
            documentId: chunk.documentId,
            documentName: chunk.document.displayName,
            position: chunk.position,
            pageNumber: chunk.pageNumber,
            content: chunk.text,
            score: Math.max(
                ...hits
                    .filter((hit) =>
                        hit.documentId === chunk.documentId &&
                        Math.abs(hit.position - chunk.position) <= neighborChunks,
                    )
                    .map((hit) => scoreById.get(hit.id) ?? 0),
            ),
        }));
    }
}