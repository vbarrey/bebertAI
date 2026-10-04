import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

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