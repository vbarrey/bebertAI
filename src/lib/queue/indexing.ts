import { Queue } from "bullmq";
import { createQueueConnection } from "./redis";
import { IndexingJobData } from "@/workers/indexing";
import { JobStatus } from "@prisma/client";

import { PipelineConfig } from "../pipeline/config";
import { prisma } from "@/lib/prisma";

export const indexingQueue = new Queue(
  "document-indexing",
  {
    connection: createQueueConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    },
  },
);

/**
 * Queues the job behind its owner's queued jobs only: its priority is 1 + their number, so that the first document
 * of each user goes before the second one of anyone, and a big import does not hold back the other users.
 * Every job gets a priority: BullMQ runs the jobs without one before all the prioritized ones.
 */
export async function enqueueIndexingJob(
  indexingJobId: string,
  pipelineConfig: PipelineConfig
) {
  const job = await prisma.indexingJob.findUniqueOrThrow({
    where: { id: indexingJobId },
    select: { createdAt: true, document: { select: { userId: true } } },
  });
  const ahead = await prisma.indexingJob.count({
    where: { status: JobStatus.QUEUED, document: { userId: job.document.userId }, createdAt: { lt: job.createdAt } },
  });

  return indexingQueue.add(
    "index-document",
    {
      indexingJobId,
      pipelineConfig
    },
    {
      jobId: indexingJobId,
      priority: ahead + 1,
    },
  );
}