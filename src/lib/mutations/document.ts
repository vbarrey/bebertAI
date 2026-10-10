import { prisma } from "@/lib/prisma";
import {
  DocumentSourceType,
  IndexingStatus,
  Prisma,
} from "@prisma/client";

import { DocumentFormat } from "@/lib/documents/format";

export async function createDocument(data: {
  id?: string;
  storagePath: string;
  displayName: string;
  format: DocumentFormat;
  fileSize: number;
  checksum: string;
  language?: string;
  sourceType: DocumentSourceType;
  sourceRef?: string | null;
  indexingStatus: IndexingStatus;
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
