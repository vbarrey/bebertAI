import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { createDocument } from "@/lib/mutations/document";
import { createIndexingJob } from "@/lib/mutations/indexing-job";
import { enqueueIndexingJob } from "@/lib/queue/indexing";
import { IndexingJobData } from "@/workers/indexing";
import { calculateFileChecksum } from "@/lib/documents/checksum";

const mimeTypesToFormat: Record<string, string> = {
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

    const format = mimeTypesToFormat[file.type];

    if (!format) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    const tmpDirectory = path.join(os.tmpdir(), process.env["TMP_FILE_REPO"] ?? "bebert-ai-file-repo");

    await mkdir(tmpDirectory, {
      recursive: true,
    });

    const uniqueFilename = `${crypto.randomUUID()}_${file.name}`;

    const filePath = path.join(tmpDirectory, uniqueFilename);

    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
    
    const checksum = await calculateFileChecksum(filePath);

    const document = await createDocument({
      filename: uniqueFilename,
      displayName: file.name,
      format,
      fileSize: file.size,
      checksum,
      indexingStatus: "PROCESSING",
    });

    const indexingJob = await createIndexingJob(document.id);

    const data: IndexingJobData = {
      indexingJobId: indexingJob.id, 
      providerId: "cmumwfrrd00008scsi0vdy3fw",// TODO : make configurable
      embeddingModelName: "qwen3-embedding:4b" // TODO : make configurable);
    }

    await enqueueIndexingJob(data);

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
      { status: 500 }
    );
  }
}
