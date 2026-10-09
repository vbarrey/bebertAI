import { UnrecoverableError, Worker, type Job } from "bullmq";

import { createWorkerConnection } from "@/lib/queue/redis";
import {
  completeIndexingJob,
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
import { deleteDocumentEmbeddings, upsertChunkEmbeddings } from "@/lib/qdrant/points";
import { ensureChunksCollection } from "@/lib/qdrant/collections";

import { IndexingStage } from "@/lib/queue/types";
import { getPipelineProvider, PipelineConfig } from "@/lib/pipeline/config";
import { ExtractionParametersSchema } from "@/lib/pipeline/parameters";
import { DocumentFormatSchema } from "@/lib/documents/format";

export type IndexingJobData = {
  indexingJobId: string;
  pipelineConfig: PipelineConfig
};

const NAME = "Document-Indexing-Worker";

// Prefixed to error messages so the UI tells which step failed.
const STAGE_LABELS: Partial<Record<IndexingStage, string>> = {
  [IndexingStage.CREATING]: "Préparation",
  [IndexingStage.EXTRACTING]: "Extraction du texte",
  [IndexingStage.CHUNKING]: "Découpage",
  [IndexingStage.PERSISTING_CHUNKS]: "Enregistrement des chunks",
  [IndexingStage.EMBEDDING]: "Embedding (Ollama)",
  [IndexingStage.PERSISTING_EMBEDDINGS]: "Enregistrement des vecteurs (Qdrant)",
};

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
        pipelineConfig
      } = job.data;

      let stage = IndexingStage.CREATING;

      const updateProgress = async (next: IndexingStage) => {
        stage = next;
        await job.updateProgress({ stage: next });
      };

      try {
        const indexingJob = await getIndexingJobById(indexingJobId);

        if (!indexingJob) {
          throw new Error(
            `Indexing job with id ${indexingJobId} not found`,
          );
        }

        const embeddingProvider = getPipelineProvider(pipelineConfig.parameters.embedding, "embedding");

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

        // Re-parsed so jobs enqueued before the OCR fields existed get their defaults.
        const extractionParameters = ExtractionParametersSchema.parse(pipelineConfig.parameters.extraction);

        const extractor = getDocumentExtractor(
          DocumentFormatSchema.parse(document.format),
          extractionParameters,
        );

        await updateProgress(IndexingStage.EXTRACTING);

        // OCR runs inside this stage: progress stays on EXTRACTING with the pages done so far.
        const extraction = await extractor.extract(
          document,
          (current, total) => job.updateProgress({ stage: IndexingStage.EXTRACTING, current, total }),
        );

        const chunker = getDocumentChunker(pipelineConfig.parameters.chunking);

        await updateProgress(IndexingStage.CHUNKING);

        const chunks = await chunker.chunk(extraction);

        if (chunks.length === 0) {
          // Retrying cannot help: the file has no text layer.
          throw new UnrecoverableError(
            extractionParameters.ocrEnabled
              ? "Aucun texte extractible dans le document, même par OCR."
              : "Aucun texte extractible dans le document (PDF scanné ?). Activez l'OCR dans Paramètres > Pipeline.",
          );
        }

        await updateProgress(IndexingStage.PERSISTING_CHUNKS);

        const persistedChunks = await replaceDocumentChunks(
          document.id,
          chunks,
        );

        const embedder = await getDocumentEmbedder(
          embeddingProvider,
          pipelineConfig.parameters.embedding.modelName,
        );

        await updateProgress(IndexingStage.EMBEDDING);

        const embeddings = await embedder.embed(
          persistedChunks,
        );

        if (embeddings.length === 0) {
          throw new Error(
            `[${NAME}] No embeddings were generated for document ${document.id}`,
          );
        }

        await updateProgress(IndexingStage.PERSISTING_EMBEDDINGS);

        const vectorSize = embeddings[0]?.embedding.length;

        if (vectorSize === undefined) {
          throw new Error(
            `[${NAME}] No embeddings were generated for document ${document.id}`,
          );
        }

        await ensureChunksCollection(vectorSize);
        // Chunks are recreated with new ids on each run: drop the previous points of the document first.
        await deleteDocumentEmbeddings(document.id);
        await upsertChunkEmbeddings(embeddings);

        await completeIndexingJob(indexingJob.id);

        await updateProgress(IndexingStage.COMPLETED);

        return {
          documentId: document.id,
          chunks: persistedChunks.length,
          embeddings: embeddings.length,
        };
      } catch (error) {
        const message = `${STAGE_LABELS[stage] ?? stage} : ${
          error instanceof Error
            ? error.message
            : "Erreur d'indexation inconnue"
        }`;

        // BullMQ will retry the job: only the last attempt marks the job and the document as FAILED.
        const isLastAttempt =
          error instanceof UnrecoverableError ||
          job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

        if (isLastAttempt) {
          await failIndexingJob(
            indexingJobId,
            message,
          );
        }

        // Rethrown with the stage so BullMQ's failedReason (sent over SSE) matches the DB message.
        throw error instanceof UnrecoverableError
          ? new UnrecoverableError(message)
          : new Error(message, { cause: error });
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