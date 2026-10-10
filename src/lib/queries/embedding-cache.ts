import { prisma } from "@/lib/prisma";

/** Cached embeddings of the given keys (see embeddingCacheKey); missing keys are absent from the map. */
export async function getCachedEmbeddings(keys: string[]): Promise<Map<string, number[]>> {
    const rows = await prisma.embeddingCache.findMany({
        where: { key: { in: keys } },
    });

    // Copied into a fresh buffer: a Float32Array needs a 4-byte aligned offset.
    return new Map(rows.map(({ key, embedding }) => [
        key,
        Array.from(new Float32Array(new Uint8Array(embedding).buffer)),
    ]));
}
