import { UnrecoverableError, Worker, type Job } from "bullmq";

import { createRedisConnection } from "@/lib/queue/redis";
import {
  completeIndexingJob,
  failIndexingJob,
  startIndexingJob,
} from "@/lib/mutations/indexing-job";
import { getIndexingJobById } from "@/lib/queries/indexing-job";

import { getDocumentExtractor } from "@/lib/rag/indexing/extractor-factory";
import { getDocumentChunker } from "@/lib/rag/indexing/chunker-factory";
import { replaceDocumentChunks } from "@/lib/mutations/chunk";
import { flagIndexedDocumentsForReindex, setDocumentLanguage } from "@/lib/mutations/document";
import { detectLanguage } from "@/lib/rag/indexing/language";
import { normalizeExtractedText } from "@/lib/rag/indexing/text";
import { getDocumentById } from "@/lib/queries/document";
import { DocumentEmbedder, embeddingContextLength } from "@/lib/rag/embedding/embedder";

import { deleteDocumentEmbeddings, upsertChunkEmbeddings } from "@/lib/qdrant/points";
import {
  chunksCollectionLacksSparseVectors,
  deleteChunksCollection,
  ensureChunksCollection,
} from "@/lib/qdrant/collections";

import { INDEXING_STAGE_LABELS, IndexingStage } from "@/lib/queue/types";
import { getPipelineProvider, PipelineConfig } from "@/lib/pipeline/config";
import { chunkingSignature, PipelineParametersSchema } from "@/lib/pipeline/parameters";
import { KEPT_CHUNKS_WARNING, keepsChunksWithoutFile, reusesChunks } from "@/lib/rag/indexing/reindex";
import { prisma } from "@/lib/prisma";
import type { Chunk } from "@prisma/client";
import { createLimiter } from "@/lib/concurrency";
import { DocumentFormatSchema } from "@/lib/documents/format";
import { withDocumentFile } from "@/lib/documents/storage";
import { isPermanentDriveError } from "@/lib/google-drive/client";
import { env } from "@/lib/env";
import { userErrorMessage } from "@/lib/ai/chat/error-message";
import { startBundleWorker } from "./bundle";

export type IndexingJobData = {
  indexingJobId: string;
  pipelineConfig: PipelineConfig
};

const NAME = "Document-Indexing-Worker";

// Each document takes a CPU slot to be extracted, then a GPU slot to be embedded: the CPU extracts the next documents
// while the GPU embeds one, neither waits for the other. The worker holds as many documents again as extracting ones:
// documents extracted and waiting for the GPU do not stop the extraction.
const cpuSlot = createLimiter(env.INDEXING_CPU_SLOTS);
const gpuSlot = createLimiter(env.INDEXING_GPU_SLOTS);
const CONCURRENCY = 2 * env.INDEXING_CPU_SLOTS + env.INDEXING_GPU_SLOTS;

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

        const signature = chunkingSignature(parameters);
        const existingChunks = await prisma.chunk.findMany({ where: { documentId: document.id }, orderBy: { position: "asc" } });
        let persistedChunks: Chunk[] = existingChunks;
        let documentLanguage = document.language;
        // Shown with the completion: the document was indexed, but not quite as asked.
        let warning: string | undefined;

        if (!reusesChunks(document, existingChunks.length, signature)) {
          await updateProgress(IndexingStage.WAITING_EXTRACTION);

          // Holds a CPU slot from the reading of the file to the chunks: the next document extracts meanwhile this one
          // is embedded.
          await cpuSlot(async () => {
            const extractor = getDocumentExtractor(
              DocumentFormatSchema.parse(document.format),
              extractionParameters,
            );

            await updateProgress(IndexingStage.EXTRACTING);

            let extracted: Awaited<ReturnType<typeof extractor.extract>> | null = null;
            try {
              // OCR runs inside this stage: progress stays on EXTRACTING with the pages done so far.
              extracted = await withDocumentFile(document, (filePath) => extractor.extract(
                filePath,
                document,
                (current, total) => job.updateProgress({ stage: IndexingStage.EXTRACTING, current, total }),
              ));
            } catch (error) {
              if (!keepsChunksWithoutFile(existingChunks.length, error)) throw error;
              warning = KEPT_CHUNKS_WARNING;
            }

            if (extracted) {
              // Every later step works on the same text: NFC, part numbers in Latin letters.
              const extraction = {
                ...extracted,
                blocks: extracted.blocks.map((block) => ({ ...block, text: normalizeExtractedText(block.text) })),
              };

              const chunker = getDocumentChunker(pipelineConfig.parameters.chunking);

              await updateProgress(IndexingStage.CHUNKING);

              // A book may hold an annex in another language: detected per chunk, the whole document as the fallback,
              // and null (BM25 without stemmer) when neither tells.
              const detected = detectLanguage(extraction.blocks.map((block) => block.text).join("\n"));
              documentLanguage = detected;

              const chunks = (await chunker.chunk(extraction)).map((chunk) => ({
                ...chunk,
                language: detectLanguage(chunk.text) ?? detected,
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

              persistedChunks = await replaceDocumentChunks(
                document.id,
                chunks,
              );

              await setDocumentLanguage(document.id, detected);
              await prisma.document.update({ where: { id: document.id }, data: { chunkedWith: signature } });
            }
          });
        }

        const embedder = new DocumentEmbedder(
          embeddingProvider,
          parameters.embedding.modelName,
          { contextLength: embeddingContextLength(parameters.chunking.chunkSize) },
        );

        await updateProgress(IndexingStage.WAITING_EMBEDDING);

        // Freed before the writes to Qdrant: the GPU goes on to the next document.
        const embeddings = await gpuSlot(async () => {
          await updateProgress(IndexingStage.EMBEDDING);

          return embedder.embed(
            persistedChunks,
            (current, total) => job.updateProgress({ stage: IndexingStage.EMBEDDING, current, total }),
          );
        });

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

        await completeIndexingJob(indexingJob.id, warning);

        await updateProgress(IndexingStage.COMPLETED);

        return {
          documentId: document.id,
          chunks: persistedChunks.length,
          embeddings: embeddings.length,
          // Forwarded by the SSE route so the documents table shows it without a reload.
          language: documentLanguage,
          warning,
        };
      } catch (error) {
        const message = `${INDEXING_STAGE_LABELS[stage] ?? stage} : ${
          error instanceof Error
            ? userErrorMessage(error)
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
      connection: createRedisConnection(),
      concurrency: CONCURRENCY,
    },
  );

  worker.on("progress", (job, progress) => {
    console.log(
      `[${NAME}] ${job.id} progress:`,
      progress,
    );
  });

  worker.on("completed", (job) => {
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
    `[${NAME}] Started`,
  );

  // The exports and imports of .bebert bundles run in this process too.
  startBundleWorker();
}

initialize().catch((error) => {
  console.error(
    `[${NAME}] Failed to initialize worker:`,
    error,
  );

  process.exit(1);
});