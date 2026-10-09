import { prisma } from "@/lib/prisma";
import { Chunk } from "@prisma/client";


export function getChunksByIds(chunksIds: string[]): Promise<Chunk[]>{
    return prisma.chunk.findMany({
        where: {
            id: { in: chunksIds }
        }
    });
}

/**
 * Chunks of each document between two positions (inclusive), with the document name.
 */
export function getChunksInRanges(ranges: { documentId: string; from: number; to: number }[]) {
    return prisma.chunk.findMany({
        where: {
            OR: ranges.map(({ documentId, from, to }) => ({
                documentId,
                position: { gte: from, lte: to },
            })),
        },
        include: { document: { select: { displayName: true } } },
    });
}
