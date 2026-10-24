import { prisma } from "@/lib/prisma";
import {
  DocumentSourceType,
  IndexingStatus,
  Prisma,
} from "@prisma/client";

import { DocumentFormat } from "@/lib/documents/format";

export async function createDocument(data: {
  id?: string;
  userId: string;
  storagePath?: string | null;
  displayName: string;
  format: DocumentFormat;
  fileSize: number;
  checksum: string;
  language?: string;
  sourceType: DocumentSourceType;
  sourceRef?: string | null;
  indexingStatus: IndexingStatus;
  // Imported for this project only.
  ownerProjectId?: string | null;
}, db: Prisma.TransactionClient = prisma) {
  return db.document.create({
    data,
  });
}

// Null when the text is too short or too mixed to tell.
export async function setDocumentLanguage(documentId: string, language: string | null) {
  return prisma.document.update({
    where: { id: documentId },
    data: { language },
  });
}

// Their vectors were deleted: they no longer answer the chat until they are reindexed.
export function flagIndexedDocumentsForReindex(db: Prisma.TransactionClient = prisma) {
  return db.document.updateMany({
    where: { indexingStatus: IndexingStatus.PROCESSED },
    data: { indexingStatus: IndexingStatus.NEEDREINDEX },
  });
}

/**
 * Adds documents already in the app to the selection of a project; its own documents are left as they are.
 * The user's project and documents only: anything else is ignored.
 */
export async function addToProjectSelection(userId: string, projectId: string, documentIds: string[]) {
    if (!(await prisma.project.count({ where: { id: projectId, userId } }))) return;

    const documents = await prisma.document.findMany({
        where: { userId, id: { in: documentIds }, OR: [{ ownerProjectId: null }, { ownerProjectId: { not: projectId } }] },
        select: { id: true },
    });

    for (const { id } of documents) {
        await prisma.projectDocument.upsert({
            where: { projectId_documentId: { projectId, documentId: id } },
            create: { projectId, documentId: id },
            update: {},
        });
    }
}
