import { createHash } from "node:crypto";
import type { Chunk } from "@prisma/client";
import type { ChunkEmbedding } from "@/lib/ai/types";
import { AIProviderClient } from "@/lib/ai/provider";
import { mapWithConcurrency } from "@/lib/concurrency";
import { getCachedEmbeddings } from "@/lib/queries/embedding-cache";
import { cacheEmbeddings } from "@/lib/mutations/embedding-cache";

export type EmbeddingCache = {
  get(keys: string[]): Promise<Map<string, number[]>>;
  set(entries: Map<string, number[]>): Promise<void>;
};

// Reports the distinct chunk texts embedded so far, the cached ones included.
export type EmbeddingProgress = (current: number, total: number) => Promise<void> | void;

// Small enough to report progress on long documents, large enough to keep the requests few.
const BATCH_SIZE = 32;
// Requests in flight: the provider always has the next batch while it sends one back, the GPU never waits.
const PARALLEL_BATCHES = 3;

/**
 * Context of the embedding requests, chunks and queries alike. A token holds at least one character, so
 * chunkSize tokens fit any chunk.
 */
export function embeddingContextLength(chunkSize: number): number {
  return Math.ceil(chunkSize / 1024) * 1024;
}

// Qwen3-Embedding (Ollama "qwen3-embedding:4b-q8_0", DeepInfra "Qwen/Qwen3-Embedding-4B") expects an instruction before
// the query, none before the documents (model card). Added here, not by the provider: Ollama and DeepInfra must
// receive the same text for their vectors to match.
const QWEN3_QUERY_INSTRUCTION = "Instruct: Given a web search query, retrieve relevant passages that answer the query\nQuery:";

/** The text embedded for a search query with this model. */
export function embeddingQueryText(modelName: string, query: string): string {
  return /qwen3-embedding/i.test(modelName) ? QWEN3_QUERY_INSTRUCTION + query : query;
}

/** Same model and same text give the same vector: a reindex that keeps the text reuses it. */
export function embeddingCacheKey(modelName: string, text: string): string {
  return createHash("sha256").update(`${modelName}\0${text}`).digest("hex");
}

export class DocumentEmbedder {

  private readonly contextLength?: number;
  private readonly cache: EmbeddingCache;

  constructor(
    private readonly provider: AIProviderClient,
    private readonly modelName: string,
    { contextLength, cache }: { contextLength?: number; cache?: EmbeddingCache } = {},
  ) {
    this.contextLength = contextLength;
    this.cache = cache ?? { get: getCachedEmbeddings, set: cacheEmbeddings };
  }

  async embed(chunks: Chunk[], onProgress?: EmbeddingProgress): Promise<ChunkEmbedding[]> {

    if (chunks.length === 0) {
      return [];
    }

    const keys = chunks.map((chunk) => embeddingCacheKey(this.modelName, chunk.text));
    // A text repeated in the document (page headers) is embedded once.
    const textByKey = new Map(keys.map((key, index) => [key, chunks[index]!.text]));
    const vectors = await this.cache.get([...textByKey.keys()]);
    const missing = [...textByKey.keys()].filter((key) => !vectors.has(key));

    let done = textByKey.size - missing.length;
    await onProgress?.(done, textByKey.size);

    const batches = Array.from(
      { length: Math.ceil(missing.length / BATCH_SIZE) },
      (_, index) => missing.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE),
    );

    await mapWithConcurrency(batches, PARALLEL_BATCHES, async (batch) => {
      const embeddings = await this.provider.embed({
        model: this.modelName,
        input: batch.map((key) => textByKey.get(key)!),
        contextLength: this.contextLength,
        inputType: "document",
      });

      if (embeddings.length !== batch.length) {
        throw new Error(
          `[DocumentEmbedder] Expected ${batch.length} embeddings, received ${embeddings.length}`,
        );
      }

      const fresh = new Map(batch.map((key, index) => [key, embeddings[index]!]));

      // Saved per batch: a job retried after a failure only embeds what is left.
      await this.cache.set(fresh);
      fresh.forEach((embedding, key) => vectors.set(key, embedding));

      done += batch.length;
      await onProgress?.(done, textByKey.size);
    });

    return chunks.map((chunk, index) => ({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      embedding: vectors.get(keys[index]!)!,
    }));
  }
}
