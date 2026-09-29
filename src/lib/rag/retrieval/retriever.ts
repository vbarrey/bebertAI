import { AIProviderClient } from "@/lib/ai/provider";
import { qdrant } from "@/lib/qdrant/client";
import { CHUNKS_COLLECTION } from "@/lib/qdrant/collections";
import { getChunksByIds } from "@/lib/queries/chunk";

export type RetrievedChunk = {
    chunkId: string;
    documentId: string;
    content: string;
    score: number;
};

export type RetrievalOptions = {
    limit?: number;
    scoreThreshold?: number;
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

        const relevantPoints = results.points
            .filter((point) => point.score >= scoreThreshold)
            .map((point) => {
                const payload = point.payload as PointPayload;
                return {
                    chunkId: payload.chunkId,
                    documentId: payload.documentId,
                    score: point.score,
                };
            });

        const relevantChunks = await getChunksByIds(relevantPoints.map(rp => rp.chunkId));

        const chunksById = new Map(
            relevantChunks.map((chunk) => [chunk.id, chunk]),
        );

        return relevantPoints.map((point) => {
            if (typeof point.chunkId !== "string") {
                return null;
            }

            const chunk = chunksById.get(point.chunkId);

            if (!chunk) {
                return null;
            }

            return {
                chunkId: chunk.id,
                documentId: chunk.documentId,
                content: chunk.text,
                score: point.score,
            };
        })
        .filter((chunk): chunk is RetrievedChunk => chunk !== null);
    }
}