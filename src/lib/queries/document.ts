import { prisma } from "@/lib/prisma";

/** Documents with the error message of their latest indexing job (null when it did not fail). */
export async function getAllDocuments() {
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      indexingJobs: {
        select: { errorMessage: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return documents.map(({ indexingJobs, ...document }) => ({
    ...document,
    indexingError: indexingJobs[0]?.errorMessage ?? null,
  }));
}

export function getDocumentById(documentId: string) {
  return prisma.document.findUnique({
    where: { id: documentId }
  });
}
