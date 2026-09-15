import { Queue } from "bullmq";
import { createQueueConnection } from "./redis";
import { PipelineConfig } from "../pipeline/config";

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
  pipelineConfig: PipelineConfig
) {
  return indexingQueue.add(
    "index-document",
    {
      indexingJobId,
      pipelineConfig
    },
    {
      jobId: indexingJobId,
    },
  );
}