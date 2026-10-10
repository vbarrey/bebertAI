import { prisma } from "@/lib/prisma";
import { JobStatus } from "@prisma/client";

/**
 * Documents with the error message of their latest indexing job (null when it did not fail)
 * and its id while it is queued or running, for the page to follow it.
 */
export async function getAllDocuments() {
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      indexingJobs: {
        select: { id: true, status: true, errorMessage: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return documents.map(({ indexingJobs: [latestJob], ...document }) => ({
    ...document,
    indexingError: latestJob?.errorMessage ?? null,
    activeJobId: latestJob && (latestJob.status === JobStatus.QUEUED || latestJob.status === JobStatus.RUNNING)
      ? latestJob.id
      : null,
  }));
}

export function getDocumentById(documentId: string) {
  return prisma.document.findUnique({
    where: { id: documentId }
  });
}
