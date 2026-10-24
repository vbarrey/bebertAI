import { UnrecoverableError, Worker, type Job } from "bullmq";

import { createWorkerConnection } from "@/lib/queue/redis";
import {
  completeIndexingJob,
  failIndexingJob,
  startIndexingJob,
} from "@/lib/mutations/indexing-job";
import { getIndexingJobById } from "@/lib/queries/indexing-job";
import { enableWriteAheadLog } from "@/lib/prisma";

import { getDocumentExtractor } from "@/lib/rag/indexing/extractor-factory";
import { getDocumentChunker } from "@/lib/rag/indexing/chunker-factory";
import { replaceDocumentChunks } from "@/lib/mutations/chunk";
import { flagIndexedDocumentsForReindex, setDocumentLanguage } from "@/lib/mutations/document";
import { detectLanguage } from "@/lib/rag/indexing/language";
import { normalizeExtractedText } from "@/lib/rag/indexing/text";
import { getDocumentById } from "@/lib/queries/document";
import { getDocumentEmbedder } from "@/lib/rag/embedding/embedder-factory";
import { embeddingContextLength } from "@/lib/rag/embedding/embedder";

import { aiProviderRegistry } from "@/lib/ai/registry";
import { initializeAI } from "@/lib/startup/initialize-ai";
import { deleteDocumentEmbeddings, upsertChunkEmbeddings } from "@/lib/qdrant/points";
import {
  chunksCollectionLacksSparseVectors,
  deleteChunksCollection,
  ensureChunksCollection,
} from "@/lib/qdrant/collections";

import { INDEXING_STAGE_LABELS, IndexingStage } from "@/lib/queue/types";
import { getPipelineProvider, PipelineConfig } from "@/lib/pipeline/config";
import { PipelineParametersSchema } from "@/lib/pipeline/parameters";
import { DocumentFormatSchema } from "@/lib/documents/format";
import { withDocumentFile } from "@/lib/documents/storage";
import { isPermanentDriveError } from "@/lib/google-drive/client";

export type IndexingJobData = {
  indexingJobId: string;
  pipelineConfig: PipelineConfig
};

const NAME = "Document-Indexing-Worker";

// Documents indexed at once: by default one OCRs on the CPU while the other one is embedded on the GPU.
const CONCURRENCY = Number(process.env.INDEXING_CONCURRENCY) || 2;

let collectionWrites: Promise<unknown> = Promise.resolve();

/**
 * Runs the collection writes of one job at a time: the first job after the BM25 upgrade deletes and recreates
 * the collection, which must not happen while the other job upserts. In-process: run a single worker process.
 */
function serializeCollectionWrites<T>(write: () => Promise<T>): Promise<T> {
  const run = collectionWrites.then(write);
  collectionWrites = run.catch(() => undefined);
  return run;
}

async function initialize() {
  /*
   * Initialisation du registry une seule fois au démarrage
   * du processus worker.
   */
  await initializeAI({ synchronizeModels: false });
  await enableWriteAheadLog();

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

        const embeddingProvider = await getPipelineProvider(pipelineConfig.parameters.embedding, "embedding");

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

        // Re-parsed so jobs enqueued before the OCR and BM25 fields existed get their defaults.
        const parameters = PipelineParametersSchema.parse(pipelineConfig.parameters);
        const extractionParameters = parameters.extraction;

        const extractor = getDocumentExtractor(
          DocumentFormatSchema.parse(document.format),
          extractionParameters,
        );

        await updateProgress(IndexingStage.EXTRACTING);

        // OCR runs inside this stage: progress stays on EXTRACTING with the pages done so far.
        const extracted = await withDocumentFile(document, (filePath) => extractor.extract(
          filePath,
          document,
          (current, total) => job.updateProgress({ stage: IndexingStage.EXTRACTING, current, total }),
        ));

        // Every later step works on the same text: NFC, part numbers in Latin letters.
        const extraction = {
          ...extracted,
          blocks: extracted.blocks.map((block) => ({ ...block, text: normalizeExtractedText(block.text) })),
        };

        const chunker = getDocumentChunker(pipelineConfig.parameters.chunking);

        await updateProgress(IndexingStage.CHUNKING);

        // A book may hold an annex in another language: detected per chunk, the whole document as the fallback,
        // and null (BM25 without stemmer) when neither tells.
        const documentLanguage = detectLanguage(extraction.blocks.map((block) => block.text).join("\n"));

        const chunks = (await chunker.chunk(extraction)).map((chunk) => ({
          ...chunk,
          language: detectLanguage(chunk.text) ?? documentLanguage,
        }));

        if (chunks.length === 0) {
          // Retrying cannot help: the file has no text layer.
          throw new UnrecoverableError(
            extractionParameters.ocrEnabled
              ? "Aucun texte extractible dans le document, même par OCR."
              : "Aucun texte extractible dans le document (PDF scanné ?). Activez l'OCR dans Réglages > Pipeline.",
          );
        }

        await updateProgress(IndexingStage.PERSISTING_CHUNKS);

        const persistedChunks = await replaceDocumentChunks(
          document.id,
          chunks,
        );

        await setDocumentLanguage(document.id, documentLanguage);

        const embedder = await getDocumentEmbedder(
          embeddingProvider,
          parameters.embedding.modelName,
          embeddingContextLength(parameters.chunking.chunkSize),
        );

        await updateProgress(IndexingStage.EMBEDDING);

        const embeddings = await embedder.embed(
          persistedChunks,
          (current, total) => job.updateProgress({ stage: IndexingStage.EMBEDDING, current, total }),
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

        await serializeCollectionWrites(async () => {
          // Created before the BM25 vectors: every point is stale, the other indexed documents need a reindex too.
          if (await chunksCollectionLacksSparseVectors(document.userId)) {
            await deleteChunksCollection(document.userId);
            await flagIndexedDocumentsForReindex(document.userId);
          }

          await ensureChunksCollection(document.userId, vectorSize);
          // Chunks are recreated with new ids on each run: drop the previous points of the document first.
          await deleteDocumentEmbeddings(document.userId, document.id);
          await upsertChunkEmbeddings(
            document.userId,
            persistedChunks,
            embeddings,
            parameters.embedding.sparse,
            parameters.chunking.chunkSize,
          );
        });

        await completeIndexingJob(indexingJob.id);

        await updateProgress(IndexingStage.COMPLETED);

        return {
          documentId: document.id,
          chunks: persistedChunks.length,
          embeddings: embeddings.length,
          // Forwarded by the SSE route so the documents table shows it without a reload.
          language: documentLanguage,
        };
      } catch (error) {
        const message = `${INDEXING_STAGE_LABELS[stage] ?? stage} : ${
          error instanceof Error
            ? error.message
            : "Erreur d'indexation inconnue"
        }`;

        const unrecoverable = error instanceof UnrecoverableError || isPermanentDriveError(error);

        // BullMQ will retry the job: only the last attempt marks the job and the document as FAILED.
        const isLastAttempt =
          unrecoverable ||
          job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

        if (isLastAttempt) {
          await failIndexingJob(
            indexingJobId,
            message,
          );
        }

        // Rethrown with the stage so BullMQ's failedReason (sent over SSE) matches the DB message.
        throw unrecoverable
          ? new UnrecoverableError(message)
          : new Error(message, { cause: error });
      }
    },
    {
      connection: createWorkerConnection(),
      concurrency: CONCURRENCY,
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