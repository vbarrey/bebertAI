import { prisma } from "@/lib/prisma";
import type { IndexedChunk } from "@/lib/rag/indexing/types";

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

    if (chunks.length > 0) {
      await tx.chunk.createMany({
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

    return tx.document.update({
      where: {
        id: documentId,
      },
      data: {
        indexingStatus: "PROCESSED",
        indexedAt: new Date(),
      },
    });
  });
}