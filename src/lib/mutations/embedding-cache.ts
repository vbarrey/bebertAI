import { prisma } from "@/lib/prisma";

/**
 * Stores embeddings as float32, the precision Ollama computes and Qdrant stores them in.
 * Upserts: two documents indexed at once may share a chunk text.
 */
export async function cacheEmbeddings(entries: Map<string, number[]>): Promise<void> {
    await prisma.$transaction(
        [...entries].map(([key, embedding]) => prisma.embeddingCache.upsert({
            where: { key },
            create: { key, embedding: new Uint8Array(new Float32Array(embedding).buffer) },
            update: {},
        })),
    );
}
