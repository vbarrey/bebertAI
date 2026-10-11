import { AIProviderClient } from "@/lib/ai/provider";
import { qdrant } from "@/lib/qdrant/client";
import { CHUNKS_COLLECTION } from "@/lib/qdrant/collections";
import { getChunksByIds, getChunksInRanges } from "@/lib/queries/chunk";
import type { PipelineParameters } from "@/lib/pipeline/parameters";
import { buildHybridQuery } from "./hybrid-query";
import type { QueryTranslations } from "./query-translator";

export type RetrievedChunk = {
    chunkId: string;
    documentId: string;
    documentName: string;
    position: number;
    pageNumber: number | null;
    content: string;
    // False for the neighbours added around the search results.
    hit: boolean;
    // Neighbours take the score of the best result they surround.
    score: number;
};

export type RetrievalOptions = {
    // The query as typed, NFC.
    query: string;
    translations: QueryTranslations;
    retrieval: PipelineParameters["retrieval"];
    sparse: PipelineParameters["embedding"]["sparse"];
    chunkSize: number;
};

type PointPayload = {
    chunkId: string;
    documentId: string;
};

export class DocumentRetriever {
    constructor(
        private readonly embeddingProvider: AIProviderClient,
        private readonly embeddingModelName: string,
        // Same as the indexing requests, or Ollama reloads the model.
        private readonly contextLength?: number,
    ) { }

    async embedQuery(query: string): Promise<number[]> {
        const embeddings = await this.embeddingProvider.embed({
            model: this.embeddingModelName,
            input: [query],
            contextLength: this.contextLength,
            // A query embeds in 0.15 s on the CPU. On the GPU, Ollama evicts the chat model when it does not leave
            // room for the embedding model, then reloads it for the answer (25 s for a 36B model).
            cpuOnly: true,
        });

        const queryEmbedding = embeddings[0];

        if (!queryEmbedding) {
            throw new Error(
                "No embedding was generated for the retrieval query",
            );
        }

        return queryEmbedding;
    }

    async search(
        queryEmbedding: number[],
        { retrieval, ...lexical }: RetrievalOptions,
    ): Promise<RetrievedChunk[]> {
        const { neighborChunks } = retrieval;

        // Deleted when pipeline parameters requiring a reindex change, until the next indexing.
        if (!(await qdrant.collectionExists(CHUNKS_COLLECTION)).exists) {
            return [];
        }

        const results = await qdrant.query(
            CHUNKS_COLLECTION,
            buildHybridQuery({ vector: queryEmbedding, retrieval, ...lexical }),
        );

        // The semantic threshold is applied by the query: in hybrid search, scores are RRF ranks.
        const scoreById = new Map(
            results.points.map((point) => [(point.payload as PointPayload).chunkId, point.score]),
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
            hit: scoreById.has(chunk.id),
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