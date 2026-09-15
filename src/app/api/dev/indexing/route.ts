import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { DocumentFormat } from "@/lib/pipeline/formats";
import { findOrCreateSourceFolder } from "@/lib/mutations/source-folder";
import { createDocument } from "@/lib/mutations/document";
import { createIndexingJob } from "@/lib/mutations/indexing-job";
import { enqueueIndexingJob } from "@/lib/queue/indexing";
import { pipelineRuntime } from "@/lib/pipeline/runtime";

const mimeTypes: Record<string, DocumentFormat> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "text/plain": "TXT",
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const format = mimeTypes[file.type];

    if (!format) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 },
      );
    }

    const { supportedFormat } = pipelineRuntime.getConfig().capabilities.import;

    if (!supportedFormat.includes(format)) {
      return NextResponse.json(
        { error: `Unsupported document format: ${format}` },
        { status: 400 },
      );
    }

    const tmpDirectory = path.join(os.tmpdir(), "bebert-indexing");

    await mkdir(tmpDirectory, {
      recursive: true,
    });

    const temporaryFileName = `${crypto.randomUUID()}-${file.name}`;

    const filePath = path.join(tmpDirectory, temporaryFileName);

    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

    const sourceFolder = await findOrCreateSourceFolder({
      path: tmpDirectory,
      label: "Development",
    });

    const document = await createDocument({
      sourceFolderId: sourceFolder.id,
      relativePath: temporaryFileName, // TODO : might change later with sub directories
      fileName: file.name,
      format,
      fileSize: file.size,
      checksum: "",
      indexingStatus: "PROCESSING",
    });

    const indexingJob = await createIndexingJob(document.id);

    await enqueueIndexingJob(indexingJob.id, pipelineRuntime.getConfig());

    return NextResponse.json({
      jobId: indexingJob.id,
    });
  } catch (error) {
    console.error("[DEV_INDEXING]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      },
      { status: 500 },
    );
  }
}
