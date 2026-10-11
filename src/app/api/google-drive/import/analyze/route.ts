import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { mapWithConcurrency } from "@/lib/concurrency";
import { calculateFileChecksumFromStream } from "@/lib/documents/checksum";
import { getImportDecisionKey } from "@/lib/documents/import";
import { GoogleDriveAuthError } from "@/lib/google-drive/auth";
import {
    downloadDriveFile,
    DriveItem,
    getDriveItem,
    GoogleDriveApiError,
    isDriveId,
    listDriveFilesRecursive,
} from "@/lib/google-drive/client";

import type {
    DocumentImportAnalysis,
    DocumentImportFile,
    DocumentImportIgnoredFile,
} from "@/types/document-import";

// Files downloaded at once to compute their checksum.
const DOWNLOAD_CONCURRENCY = 4;

const DriveIdSchema = z.string().refine(isDriveId, "Identifiant Google Drive invalide");

const AnalyzeRequestSchema = z.object({
    fileIds: z.array(DriveIdSchema).default([]),
    folderIds: z.array(DriveIdSchema).default([]),
}).refine(
    ({ fileIds, folderIds }) => fileIds.length + folderIds.length > 0,
    "Aucun fichier ni dossier sélectionné.",
);

type Candidate = DriveItem & { relativePath?: string };

/**
 * Files picked directly and the files under the picked folders, each once.
 */
async function collectFiles(fileIds: string[], folderIds: string[]): Promise<Candidate[]> {
    const files = new Map<string, Candidate>();

    for (const id of fileIds) {
        const item = await getDriveItem(id);

        if (!item.isFolder) {
            files.set(item.id, item);
        }
    }

    for (const id of folderIds) {
        for (const item of await listDriveFilesRecursive(await getDriveItem(id))) {
            if (!files.has(item.id)) {
                files.set(item.id, item);
            }
        }
    }

    return [...files.values()];
}

/**
 * Same analysis as the local import, the checksum computed from the file streamed from Drive (nothing is stored).
 */
export async function POST(request: Request) {
    const parsed = AnalyzeRequestSchema.safeParse(await request.json().catch(() => undefined));

    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
            { status: 400 },
        );
    }

    try {
        const files = await collectFiles(parsed.data.fileIds, parsed.data.folderIds);

        const ignored: DocumentImportIgnoredFile[] = [];
        const analyzed: DocumentImportFile[] = [];

        const supported = files.filter((file) => {
            if (file.format) {
                return true;
            }

            ignored.push({
                key: `drive:${file.id}`,
                displayName: file.name,
                relativePath: file.relativePath,
                reason: "UNSUPPORTED_FORMAT",
            });

            return false;
        });

        const checksums = await mapWithConcurrency(
            supported,
            DOWNLOAD_CONCURRENCY,
            async (file) => calculateFileChecksumFromStream(await downloadDriveFile(file.id)),
        );

        const seenChecksums = new Set<string>();

        for (const [index, file] of supported.entries()) {
            const checksum = checksums[index]!;
            const key = getImportDecisionKey(checksum, file.name);

            if (seenChecksums.has(checksum)) {
                ignored.push({
                    key,
                    displayName: file.name,
                    relativePath: file.relativePath,
                    reason: "DUPLICATE",
                });

                continue;
            }

            seenChecksums.add(checksum);

            const existingDocument = await prisma.document.findUnique({
                where: { checksum },
                select: { id: true, displayName: true, checksum: true },
            });

            analyzed.push({
                key,
                displayName: file.name,
                format: file.format!,
                fileSize: file.size ?? 0,
                checksum,
                relativePath: file.relativePath,
                sourceRef: file.id,
                conflict: existingDocument
                    ? {
                        documentId: existingDocument.id,
                        displayName: existingDocument.displayName,
                        checksum: existingDocument.checksum,
                    }
                    : null,
            });
        }

        const result: DocumentImportAnalysis = { files: analyzed, ignored };

        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof GoogleDriveAuthError) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        if (error instanceof GoogleDriveApiError && error.status === 404) {
            return NextResponse.json(
                { error: "Un fichier ou dossier sélectionné est introuvable dans Google Drive." },
                { status: 404 },
            );
        }

        console.error("Google Drive import analysis failed:", error);

        return NextResponse.json(
            { error: "Impossible d'analyser les fichiers Google Drive." },
            { status: 500 },
        );
    }
}
