import { Queue } from "bullmq";
import { createQueueConnection } from "./redis";

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

export async function enqueueIndexingJob(
  indexingJobId: string,
) {
  return indexingQueue.add(
    "index-document",
    {
      indexingJobId,
    },
    {
      jobId: indexingJobId,
    },
  );
}