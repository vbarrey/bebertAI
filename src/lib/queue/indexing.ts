import { Queue } from "bullmq";
import { createQueueConnection } from "./redis";
import { IndexingJobData } from "@/workers/indexing";

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

export async function enqueueIndexingJob(data: IndexingJobData
) {
  return indexingQueue.add(
    "index-document",
    {
      ...data
    },
    {
      jobId: data.indexingJobId,
    },
  );
}