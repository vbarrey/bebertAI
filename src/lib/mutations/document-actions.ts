"use server";

// The document actions of the documents page and of the projects. Apart from document.ts: every export of a
// "use server" file can be called from the browser, the helpers of document.ts must not.

import { IndexingStatus, JobStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { deleteDocumentFile } from "@/lib/documents/storage";
import { getPipelineConfig } from "@/lib/pipeline/runtime";
import { deleteDocumentEmbeddings } from "@/lib/qdrant/points";
import { enqueueIndexingJob } from "@/lib/queue/indexing";
import { requireUser } from "@/lib/session";

type IndexingResult = { indexingJobId: string } | { error: string };

const INDEXABLE_STATUSES: IndexingStatus[] = [IndexingStatus.UNPLANNED, IndexingStatus.FAILED, IndexingStatus.CANCELLED];

/** Indexes a document never indexed, or whose last indexing failed or was cancelled. */
export async function indexDocument(documentId: string): Promise<IndexingResult> {
  const user = await requireUser();

  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId, userId: user.id },
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

    await enqueueIndexingJob(indexingJob.id, await getPipelineConfig(user.id));

    return { indexingJobId: indexingJob.id };
  } catch (error) {
    // The cause stays in the server logs; returned, not thrown: a thrown error reaches the browser as a generic one.
    console.error(`Document indexing failed (${documentId}):`, error);
    return { error: "Impossible de lancer l'indexation." };
  }
}

/** Indexes a document again, its chunks replaced; not while it is being indexed. */
export async function reindexDocument(documentId: string): Promise<IndexingResult> {
  const user = await requireUser();

  try {
    const indexingJob = await prisma.$transaction(async (tx) => {
      const document = await tx.document.findUnique({
        where: { id: documentId, userId: user.id },
        select: { id: true, indexingStatus: true },
      });

      if (!document) {
        return { error: "Document introuvable." };
      }

      if (document.indexingStatus === IndexingStatus.PENDING || document.indexingStatus === IndexingStatus.PROCESSING) {
        return { error: "Le document est déjà en cours d'indexation." };
      }

      await tx.chunk.deleteMany({ where: { documentId: document.id } });
      await tx.document.update({ where: { id: document.id }, data: { indexingStatus: IndexingStatus.PENDING } });

      return tx.indexingJob.create({ data: { documentId: document.id, status: JobStatus.QUEUED } });
    });

    if ("error" in indexingJob) {
      return indexingJob;
    }

    await enqueueIndexingJob(indexingJob.id, await getPipelineConfig(user.id));

    return { indexingJobId: indexingJob.id };
  } catch (error) {
    console.error(`Document reindexing failed (${documentId}):`, error);
    return { error: "Impossible de réindexer le document." };
  }
}

/** Deletes the document, its file and its vectors. */
export async function deleteDocument(documentId: string): Promise<{ error: string } | undefined> {
  const user = await requireUser();

  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId, userId: user.id },
      select: { id: true, storagePath: true },
    });

    if (!document) {
      return { error: "Document introuvable." };
    }

    await prisma.document.delete({ where: { id: document.id } });
    await deleteDocumentFile(document.storagePath);

    await deleteDocumentEmbeddings(user.id, document.id).catch((error) =>
      console.error(`Failed to delete embeddings of document ${document.id}:`, error),
    );
  } catch (error) {
    console.error(`Failed to delete document ${documentId}:`, error);
    return { error: "Impossible de supprimer le document." };
  }
}
