import { Worker, type Job } from "bullmq";

import { createWorkerConnection } from "@/lib/queue/redis";
import {
  completeIndexingJob,
  failIndexingJob,
  startIndexingJob,
} from "@/lib/mutations/indexing-job";
import { getIndexingJobById } from "@/lib/queries/indexing-job";
import { DocumentIndexer } from "@/lib/rag/indexing/indexer";
import { PipelineConfig } from "@/lib/pipeline/config";

type IndexingJobData = {
  indexingJobId: string;
  pipelineConfig: PipelineConfig
};

const worker = new Worker<IndexingJobData>(
  "document-indexing",
  async (job: Job<IndexingJobData>) => {
    const {indexingJobId, pipelineConfig} = job.data;

    const indexingJob = await getIndexingJobById(indexingJobId);

    if (!indexingJob) {
      throw new Error(`Indexing job "${job.data.indexingJobId}" not found`);
    }

    await startIndexingJob(indexingJob.id);

    try {
      const indexer = new DocumentIndexer(indexingJob.documentId, pipelineConfig, (progress) => job.updateProgress(progress));

      await indexer.index();

      await completeIndexingJob(indexingJob.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown indexing error";

      await failIndexingJob(indexingJob.id, message);

      throw error;
    }
  },
  {
    connection: createWorkerConnection(),
    concurrency: 1,
  }
);

worker.on("progress", (job, progress) => {
  console.log(
    `[indexing] ${job.id} progress:`,
    progress,
  );
});

worker.on("completed", (job) => {
  console.log(`[indexing] Job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`[indexing] Job ${job?.id} failed:`, error);
});

worker.on("error", (error) => {
  console.error("[indexing] Worker error:", error);
});
