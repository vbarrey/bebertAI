import { prisma } from "@/lib/prisma";
import { IndexingStatus, MimeType } from "@prisma/client";

export async function createDocument(data: {
  sourceFolderId: string;
  relativePath: string;
  fileName: string;
  mimeType?: MimeType;
  fileSize?: number;
  checksum: string;
  language?: string;
  indexingStatus: IndexingStatus;
}) {
  return prisma.document.create({
    data,
  });
}