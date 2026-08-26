import { prisma } from "@/lib/prisma";

export async function createIndexingJob(
  documentId: string,
) {
  return prisma.indexingJob.create({
    data: {
      documentId,
    },
  });
}

export async function startIndexingJob(
  id: string,
) {
  return prisma.indexingJob.update({
    where: { id },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      errorMessage: null,
    },
  });
}

export async function completeIndexingJob(
  id: string,
) {
  return prisma.indexingJob.update({
    where: { id },
    data: {
      status: "COMPLETED",
      finishedAt: new Date(),
    },
  });
}

export async function failIndexingJob(
  id: string,
  errorMessage: string,
) {
  return prisma.indexingJob.update({
    where: { id },
    data: {
      status: "FAILED",
      errorMessage,
      finishedAt: new Date(),
    },
  });
}