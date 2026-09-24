import type { Chunk } from "@prisma/client";
import type { ChunkEmbedding } from "@/lib/ai/types";
import { AIProviderClient } from "@/lib/ai/provider";

export class DocumentEmbedder {

  constructor(
    private readonly provider: AIProviderClient,
    private readonly modelName: string
  ) {}

  async embed(chunks: Chunk[]): Promise<ChunkEmbedding[]> {
    if (!this.provider.embed) {
      throw new Error(`Provider ${this.provider.name} does not support embedding`);
    }

    if (chunks.length === 0) {
      return [];
    }

    const embeddings = await this.provider.embed({
      model: this.modelName,
      chunks: chunks.map((chunk) => chunk.text)
    });

    if (embeddings.length !== chunks.length) {
      throw new Error(
        `[DocumentEmbedder] Expected ${chunks.length} embeddings, received ${embeddings.length}`,
      );
    }

    return chunks.map((chunk, index) => ({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      embedding: embeddings[index],
    }));
  }
}