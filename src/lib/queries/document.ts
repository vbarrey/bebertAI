import { prisma } from "@/lib/prisma";

export function getDocumentWithSourceFolder(documentId: string) {
  return prisma.document.findUnique({
    where: { id: documentId },
    include: { sourceFolder: true },
  });
}
