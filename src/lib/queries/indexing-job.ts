import { prisma } from "@/lib/prisma";

export async function getIndexingJobById(indexingJobId: string) {
  return prisma.indexingJob.findUnique({ where: { id: indexingJobId } });
}
