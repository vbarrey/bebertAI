import { prisma } from "@/lib/prisma";
import type { IndexedChunk } from "@/lib/rag/types";
import { Chunk } from "@prisma/client";

/**
 * Replaces the chunks of a document with new ones.
 * @param documentId the id of the document to update
 * @param chunks the new chunks to replace the old ones with
 * @returns the updated chunks
 * @throws an error if the document is not found or if there is an error updating the chunks
 */
export async function replaceDocumentChunks(
  documentId: string,
  chunks: IndexedChunk[],
) {
  return prisma.$transaction(async (tx) => {
    await tx.chunk.deleteMany({
      where: {
        documentId,
      },
    });

    let createdChunks: Chunk[] = [];

    if (chunks.length > 0) {
      createdChunks = await tx.chunk.createManyAndReturn({
        data: chunks.map((chunk) => ({
          documentId,
          position: chunk.position,
          text: chunk.text,
          pageNumber: chunk.pageNumber,
          x: chunk.bounds?.x,
          y: chunk.bounds?.y,
          width: chunk.bounds?.width,
          height: chunk.bounds?.height,
        })),
      });
    }

    return createdChunks;
  });
}