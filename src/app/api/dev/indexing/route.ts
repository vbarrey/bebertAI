import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { prisma } from "@/lib/prisma";
import { MimeType } from "@prisma/client";
import { DocumentIndexer } from "@/lib/rag/indexing/indexer";

const mimeTypes: Record<string, MimeType> = {
  "application/pdf": MimeType.PDF,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    MimeType.DOCX,
  "text/plain": MimeType.TXT,
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const mimeType = mimeTypes[file.type];

    if (!mimeType) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    const tmpDirectory = path.join(os.tmpdir(), "bebert-indexing");

    await mkdir(tmpDirectory, {
      recursive: true,
    });

    const temporaryFileName = `${crypto.randomUUID()}-${file.name}`;

    const filePath = path.join(tmpDirectory, temporaryFileName);

    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

    const sourceFolder = await prisma.sourceFolder.upsert({
      where: {
        path: tmpDirectory,
      },
      update: {},
      create: {
        path: tmpDirectory,
        label: "Development",
      },
    });

    const document = await prisma.document.create({
      data: {
        sourceFolderId: sourceFolder.id,
        relativePath: filePath,
        fileName: file.name,
        mimeType,
        fileSize: file.size,
        checksum: "",
        indexingStatus: "PROCESSING",
      },
    });

    const indexer = new DocumentIndexer(document.id);

    const result = await indexer.index();

    return NextResponse.json(result);
  } catch (error) {
    console.error("[DEV_INDEXING]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
