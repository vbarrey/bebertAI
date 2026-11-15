"use server";

// The document actions of the documents page and of the projects. Apart from document.ts: every export of a
// "use server" file can be called from the browser, the helpers of document.ts must not. The functions not
// exported below are not reachable from the browser.

import { revalidatePath } from "next/cache";
import { IndexingStatus, JobStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { deleteDocumentFile } from "@/lib/documents/storage";
import { getPipelineConfig } from "@/lib/pipeline/runtime";
import { deleteDocumentEmbeddings } from "@/lib/qdrant/points";
import { enqueueIndexingJob } from "@/lib/queue/indexing";
import { requireUser } from "@/lib/session";

/** The outcome for each document given, in the same order: what the action returns, or why it failed. */
export type DocumentActionResult<T = object> = { documentId: string } & ((T & { error?: undefined }) | { error: string });

const INDEXABLE_STATUSES: IndexingStatus[] = [IndexingStatus.UNPLANNED, IndexingStatus.FAILED, IndexingStatus.CANCELLED];

/** Indexes the documents never indexed, or whose last indexing failed or was cancelled. */
export async function indexDocuments(documentIds: string[]): Promise<DocumentActionResult<{ indexingJobId: string }>[]> {
  const user = await requireUser();
  return runOnEach(documentIds, (documentId) => indexDocument(user.id, documentId));
}

/** Indexes the documents again, their chunks replaced; not while they are being indexed. */
export async function reindexDocuments(documentIds: string[]): Promise<DocumentActionResult<{ indexingJobId: string }>[]> {
  const user = await requireUser();
  return runOnEach(documentIds, (documentId) => reindexDocument(user.id, documentId));
}

/** Deletes the documents, their files and their vectors. */
export async function deleteDocuments(documentIds: string[]): Promise<DocumentActionResult[]> {
  const user = await requireUser();
  return runOnEach(documentIds, (documentId) => deleteDocument(user.id, documentId));
}

/**
 * One request and one new rendering of the page for a whole selection. One after the other: SQLite transactions.
 * The pages listing the documents are rendered again, and sent back with the result to the page that called.
 */
async function runOnEach<T>(
  documentIds: unknown,
  run: (documentId: string) => Promise<T | { error: string }>,
): Promise<DocumentActionResult<T>[]> {
  // Any value can be sent to a server action.
  if (!Array.isArray(documentIds) || !documentIds.every((id) => typeof id === "string")) {
    throw new Error("Liste de documents invalide.");
  }

  const results: DocumentActionResult<T>[] = [];

  for (const documentId of documentIds) {
    results.push({ documentId, ...(await run(documentId)) });
  }

  revalidatePath("/documents");
  revalidatePath("/projects/[projectId]", "page");

  return results;
}

async function indexDocument(userId: string, documentId: string): Promise<{ indexingJobId: string } | { error: string }> {
  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId, userId },
      select: { id: true, indexingStatus: true },
    });

    if (!document) {
      return { error: "Document introuvable." };
    }

    if (!INDEXABLE_STATUSES.includes(document.indexingStatus)) {
      return { error: "Ce document ne peut pas être indexé dans son état actuel. Essayer de le ré-indexer." };
    }

    const indexingJob = await prisma.$transaction(async (tx) => {
      const job = await tx.indexingJob.create({ data: { documentId: document.id, status: JobStatus.QUEUED } });
      await tx.document.update({ where: { id: document.id }, data: { indexingStatus: IndexingStatus.PENDING } });
      return job;
    });

    await enqueueIndexingJob(indexingJob.id, await getPipelineConfig(userId));

    return { indexingJobId: indexingJob.id };
  } catch (error) {
    // The cause stays in the server logs; returned, not thrown: a thrown error reaches the browser as a generic one.
    console.error(`Document indexing failed (${documentId}):`, error);
    return { error: "Impossible de lancer l'indexation." };
  }
}

async function reindexDocument(userId: string, documentId: string): Promise<{ indexingJobId: string } | { error: string }> {
  try {
    const indexingJob = await prisma.$transaction(async (tx) => {
      const document = await tx.document.findUnique({
        where: { id: documentId, userId },
        select: { id: true, indexingStatus: true },
      });

      if (!document) {
        return { error: "Document introuvable." };
      }

      if (document.indexingStatus === IndexingStatus.PENDING || document.indexingStatus === IndexingStatus.PROCESSING) {
        return { error: "Le document est déjà en cours d'indexation." };
      }

      // The chunks stay: the worker embeds them again when they were made with the pipeline's chunking, or keeps them
      // when the file is out of reach; otherwise it replaces them.
      await tx.document.update({ where: { id: document.id }, data: { indexingStatus: IndexingStatus.PENDING } });

      return tx.indexingJob.create({ data: { documentId: document.id, status: JobStatus.QUEUED } });
    });

    if ("error" in indexingJob) {
      return indexingJob;
    }

    await enqueueIndexingJob(indexingJob.id, await getPipelineConfig(userId));

    return { indexingJobId: indexingJob.id };
  } catch (error) {
    console.error(`Document reindexing failed (${documentId}):`, error);
    return { error: "Impossible de réindexer le document." };
  }
}

async function deleteDocument(userId: string, documentId: string): Promise<object | { error: string }> {
  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId, userId },
      select: { id: true, storagePath: true },
    });

    if (!document) {
      return { error: "Document introuvable." };
    }

    await prisma.document.delete({ where: { id: document.id } });
    await deleteDocumentFile(document.storagePath);

    await deleteDocumentEmbeddings(userId, document.id).catch((error) =>
      console.error(`Failed to delete embeddings of document ${document.id}:`, error),
    );

    return {};
  } catch (error) {
    console.error(`Failed to delete document ${documentId}:`, error);
    return { error: "Impossible de supprimer le document." };
  }
}
