import { prisma } from "@/lib/prisma";

export function getAllDocuments() {
  return prisma.document.findMany({orderBy: { createdAt: "desc" }});
}

export function getDocumentWithSourceFolder(documentId: string) {
  return prisma.document.findUnique({
    where: { id: documentId },
    include: { sourceFolder: true },
  });
}
