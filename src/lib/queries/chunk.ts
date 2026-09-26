
import { prisma } from "@/lib/prisma";
import { Chunk } from "@prisma/client";


export function getChunksByIds(chunksIds: string[]): Promise<Chunk[]>{
    return prisma.chunk.findMany({
        where: {
            id: { in: chunksIds }
        }
    });
}