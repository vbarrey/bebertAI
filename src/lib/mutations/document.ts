import { prisma } from "@/lib/prisma";
import { IndexingStatus } from "@prisma/client";

export async function createDocument(data: {
  filename: string;
  displayName: string;
  format: string;
  fileSize?: number;
  checksum: string;
  language?: string;
  indexingStatus: IndexingStatus;
}) {
  return prisma.document.create({
    data,
  });
}