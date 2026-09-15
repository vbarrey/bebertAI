import { prisma } from "@/lib/prisma";
import { DocumentFormat } from "../pipeline/formats";
import { IndexingStatus } from "@prisma/client";

export async function createDocument(data: {
  sourceFolderId: string;
  relativePath: string;
  fileName: string;
  format?: DocumentFormat;
  fileSize?: number;
  checksum: string;
  language?: string;
  indexingStatus: IndexingStatus;
}) {
  return prisma.document.create({
    data,
  });
}