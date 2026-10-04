import { NextResponse } from "next/server";

import { pipelineCapabilities } from "@/lib/pipeline/capabilities";
import {
  calculateFileChecksumFromStream,
} from "@/lib/documents/checksum";
import { getDocumentFormat } from "@/lib/documents/format";
import { prisma } from "@/lib/prisma";

import type {
  DocumentImportAnalysis,
  DocumentImportFile,
  DocumentImportIgnoredFile,
} from "@/types/document-import";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);

    const relativePaths = formData
      .getAll("relativePaths")
      .map(String);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Aucun fichier fourni." },
        { status: 400 },
      );
    }

    const supportedFormats =
      pipelineCapabilities.import.supportedFormat;

    const analyzed: DocumentImportFile[] = [];
    const ignored: DocumentImportIgnoredFile[] = [];

    const seenChecksums = new Set<string>();

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const relativePath = relativePaths[index] || undefined;

      const format = getDocumentFormat(
        file.name,
        file.type,
      );

      if (
        !format ||
        !supportedFormats.includes(format)
      ) {
        ignored.push({
          key: `${file.name}:${file.size}:${file.lastModified}`,
          displayName: file.name,
          relativePath,
          reason: "UNSUPPORTED_FORMAT",
        });

        continue;
      }

      const checksum =
        await calculateFileChecksumFromStream(
          file.stream(),
        );

      if (seenChecksums.has(checksum)) {
        ignored.push({
          key: `${checksum}:${file.name}`,
          displayName: file.name,
          relativePath,
          reason: "DUPLICATE",
        });

        continue;
      }

      seenChecksums.add(checksum);

      const existingDocument =
        await prisma.document.findUnique({
          where: {
            checksum,
          },
          select: {
            id: true,
            displayName: true,
            checksum: true,
          },
        });

      analyzed.push({
        key: `${checksum}:${file.name}`,
        displayName: file.name,
        format,
        fileSize: file.size,
        checksum,
        relativePath,
        conflict: existingDocument
          ? {
              documentId: existingDocument.id,
              displayName: existingDocument.displayName,
              checksum: existingDocument.checksum,
            }
          : null,
      });
    }

    const result: DocumentImportAnalysis = {
      files: analyzed,
      ignored,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "Document import analysis failed:",
      error,
    );

    return NextResponse.json(
      {
        error: "Impossible d'analyser les fichiers.",
      },
      { status: 500 },
    );
  }
}