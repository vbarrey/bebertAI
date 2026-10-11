import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Document } from "@prisma/client";

const DOCUMENTS_STORAGE_PATH =
  process.env.DOCUMENTS_STORAGE_PATH ?? "./data/documents";

export async function ensureDocumentStorage() {
  await mkdir(DOCUMENTS_STORAGE_PATH, {
    recursive: true,
  });
}

export function getDocumentFilePath(storagePath: string) {
  return path.join(DOCUMENTS_STORAGE_PATH, storagePath);
}

export async function storeDocumentFile(
  storagePath: string,
  data: Buffer,
) {
  await ensureDocumentStorage();

  const filePath = getDocumentFilePath(storagePath);

  await writeFile(filePath, data);

  return filePath;
}

export async function deleteDocumentFile(
  storagePath: string | null,
) {
  if (!storagePath) {
    return;
  }

  const filePath = getDocumentFilePath(storagePath);

  await unlink(filePath).catch(() => undefined);
}

/**
 * Runs `use` with a local path to the document's file: the stored copy of a local document.
 */
export async function withDocumentFile<T>(
  document: Pick<Document, "id" | "sourceType" | "storagePath">,
  use: (filePath: string) => Promise<T>,
): Promise<T> {
  if (document.sourceType === "LOCAL" && document.storagePath) {
    return use(getDocumentFilePath(document.storagePath));
  }

  throw new Error(
    `Document ${document.id} has no file (source ${document.sourceType}).`,
  );
}