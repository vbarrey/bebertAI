import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type { Document } from "@prisma/client";

import { downloadDriveFile } from "@/lib/google-drive/client";

const DOCUMENTS_STORAGE_PATH =
  process.env.DOCUMENTS_STORAGE_PATH ?? "./data/documents";

export async function ensureDocumentStorage() {
  await mkdir(DOCUMENTS_STORAGE_PATH, {
    recursive: true,
  });
}

export function getDocumentFilePath(storagePath: string) {
  // Not traced by the build: the folder is only known at run time.
  return path.join(/*turbopackIgnore: true*/ DOCUMENTS_STORAGE_PATH, storagePath);
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
 * Runs `run` with a local path to the document's file: the stored copy of a local document,
 * a temporary download of a Google Drive one, deleted once `run` is done.
 */
export async function withDocumentFile<T>(
  document: Pick<Document, "id" | "sourceType" | "storagePath" | "sourceRef">,
  run: (filePath: string) => Promise<T>,
): Promise<T> {
  if (document.sourceType === "LOCAL" && document.storagePath) {
    return run(getDocumentFilePath(document.storagePath));
  }

  if (document.sourceType === "GOOGLE_DRIVE" && document.sourceRef) {
    const directory = await mkdtemp(path.join(tmpdir(), "bebert-drive-"));

    try {
      const filePath = path.join(directory, document.id);

      await pipeline(
        Readable.fromWeb((await downloadDriveFile(document.sourceRef)) as NodeReadableStream<Uint8Array>),
        createWriteStream(filePath),
      );

      return await run(filePath);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  throw new Error(
    `Document ${document.id} has no file (source ${document.sourceType}).`,
  );
}