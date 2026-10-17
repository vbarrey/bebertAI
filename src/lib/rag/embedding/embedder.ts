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

// Small enough to report progress on long documents, large enough to keep the GPU busy.
const BATCH_SIZE = 32;
// Ollama embeds one sequence at a time whatever OLLAMA_NUM_PARALLEL (it starts embedding models with -np 1):
// a second request in flight only keeps the GPU busy between two requests.
const PARALLEL_BATCHES = 2;

/**
 * Context of the embedding requests, chunks and queries alike (Ollama reloads the model when it changes).
 * A token holds at least one character, so chunkSize tokens fit any chunk. The model default, 40960 tokens for
 * qwen3-embedding, takes 9.3 GB of VRAM against 3.8 GB at 2048: room left for the chat model.
 */
export function embeddingContextLength(chunkSize: number): number {
  return Math.ceil(chunkSize / 1024) * 1024;
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
