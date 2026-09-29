import { Worker, type Job } from "bullmq";

import { createWorkerConnection } from "@/lib/queue/redis";
import {
  failIndexingJob,
  startIndexingJob,
} from "@/lib/mutations/indexing-job";
import { getIndexingJobById } from "@/lib/queries/indexing-job";

import { getDocumentExtractor } from "@/lib/rag/indexing/extractor-factory";
import { getDocumentChunker } from "@/lib/rag/indexing/chunker-factory";
import { replaceDocumentChunks } from "@/lib/mutations/chunk";
import { getDocumentById } from "@/lib/queries/document";
import { getDocumentEmbedder } from "@/lib/rag/embedding/embedder-factory";

import { aiProviderRegistry } from "@/lib/ai/registry";
import { initializeAI } from "@/lib/startup/initialize-ai";
import { upsertChunkEmbeddings } from "@/lib/qdrant/points";
import { ensureChunksCollection } from "@/lib/qdrant/collections";

import { IndexingStage, IndexingSteps } from "@/lib/queue/types";

export type IndexingJobData = {
  indexingJobId: string;
  providerId: string;
  embeddingModelName: string;
};

const NAME = "Document-Indexing-Worker";

async function updateProgress(
  job: Job<IndexingJobData>,
  progress: IndexingSteps,
) {
  await job.updateProgress(progress);
}

async function initialize() {
  /*
   * Initialisation du registry une seule fois au démarrage
   * du processus worker.
   */
  await initializeAI();

  const worker = new Worker<IndexingJobData>(
    "document-indexing",
    async (job: Job<IndexingJobData>) => {
      const {
        indexingJobId,
        providerId,
        embeddingModelName,
      } = job.data;

      try {
        const indexingJob = await getIndexingJobById(indexingJobId);

        if (!indexingJob) {
          throw new Error(
            `Indexing job with id ${indexingJobId} not found`,
          );
        }

        const provider = aiProviderRegistry.get(providerId);

        if (!provider) {
          throw new Error(
            `Provider with id ${providerId} not found`,
          );
        }

        await startIndexingJob(indexingJob.id);

        const documentId = indexingJob.documentId;

        if (!documentId) {
          throw new Error(
            `DocumentId is not defined for indexing job ${indexingJob.id}`,
          );
        }

        const document = await getDocumentById(documentId);

        if (!document) {
          throw new Error(
            `[${NAME}] Document with id ${documentId} does not exist - Unable to index it`,
          );
        }

        const extractor = getDocumentExtractor(document.format);

        await updateProgress(job, {
          stage: IndexingStage.EXTRACTING
        });

        const extraction = await extractor.extract(document);

        const chunker = getDocumentChunker();

        await updateProgress(job, {
          stage: IndexingStage.CHUNKING
        });

        const chunks = await chunker.chunk(extraction);

        await updateProgress(job, {
          stage: IndexingStage.PERSISTING_CHUNKS
        });

        const persistedChunks = await replaceDocumentChunks(
          document.id,
          chunks,
        );

        if (persistedChunks.length === 0) {
          console.error(
            `[${NAME}] No chunks were persisted for document with id ${document.id}`,
          );
        }

        const embedder = await getDocumentEmbedder(
          provider,
          embeddingModelName,
        );

        await updateProgress(job, {
          stage: IndexingStage.EMBEDDING
        });

        const embeddings = await embedder.embed(
          persistedChunks,
        );

        if (embeddings.length === 0) {
          throw new Error(
            `[${NAME}] No embeddings were generated for document ${document.id}`,
          );
        }

        await updateProgress(job, {
          stage: IndexingStage.PERSISTING_EMBEDDINGS
        });

        const vectorSize = embeddings[0]?.embedding.length;

        if (vectorSize === undefined) {
          throw new Error(
            `[${NAME}] No embeddings were generated for document ${document.id}`,
          );
        }

        await ensureChunksCollection(vectorSize);
        await upsertChunkEmbeddings(embeddings);

        await updateProgress(job, {
          stage: IndexingStage.COMPLETED
        });

        return {
          documentId: document.id,
          chunks: persistedChunks.length,
          embeddings: embeddings.length,
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown indexing error";

        await failIndexingJob(
          indexingJobId,
          message,
        );

        throw error;
      }
    },
    {
      connection: createWorkerConnection(),
      concurrency: 1,
    },
  );

  worker.on("progress", (job, progress) => {
    console.log(
      `[${NAME}] ${job.id} progress:`,
      progress,
    );
  });

  worker.on("completed", (job, result) => {
    console.log(
      `[${NAME}] Job ${job.id} completed`,
    );

    console.log("RESULT =>", result);
  });

  worker.on("failed", (job, error) => {
    console.error(
      `[${NAME}] Job ${job?.id} failed:`,
      error,
    );
  });

  worker.on("error", (error) => {
    console.error(
      `[${NAME}] Worker error:`,
      error,
    );
  });

  console.log(
    `[${NAME}] Started with ${aiProviderRegistry.getNbProvider()} providers`,
  );
}

initialize().catch((error) => {
  console.error(
    `[${NAME}] Failed to initialize worker:`,
    error,
  );

  process.exit(1);
});