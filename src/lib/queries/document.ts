import { prisma } from "@/lib/prisma";

export function getAllDocuments() {
  return prisma.document.findMany({orderBy: { createdAt: "desc" }});
}

export function getDocumentById(documentId: string) {
  return prisma.document.findUnique({
    where: { id: documentId }
  });
}
