import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";
import { pipelineCapabilities } from "@/lib/pipeline/capabilities";
import { getDocumentFormat } from "@/lib/documents/format";
import {
    calculateFileChecksumFromStream,
} from "@/lib/documents/checksum";

import {
    createIndexingJob,
} from "@/lib/mutations/indexing-job";

import {
    enqueueIndexingJob,
} from "@/lib/queue/indexing";

import type {
    DocumentImportConflictAction,
    DocumentImportDecision,
} from "@/types/document-import";

import type { IndexingJobData } from "@/workers/indexing";
import { pipelineRuntime } from "@/lib/pipeline/runtime";
import { Document, JobStatus } from "@prisma/client";

const DEFAULT_EMBEDDING_PROVIDER_ID =
    "cmumwfrrd00008scsi0vdy3fw";

const DEFAULT_EMBEDDING_MODEL =
    "qwen3-embedding:4b";

type ImportedFile = {
    file: File;
    relativePath?: string;
    format: string;
    checksum: string;
};

type CreatedJob = {
    indexingJobId: string;
    providerId: string;
    embeddingModelName: string;
};

type ImportResponse =
    | { error: string; }
    | {
        importedDocuments: Document[],
        createdJobIds: string[]
        skipped: boolean
    }

export async function POST(request: Request): Promise<NextResponse<ImportResponse>> {
    try {
        const formData = await request.formData();

        const files = formData
            .getAll("files")
            .filter((entry): entry is File => entry instanceof File);

        const relativePaths = formData
            .getAll("relativePaths")
            .map(String);

        const indexImmediately =
            formData.get("indexImmediately") ===
            "true";

        const decisionsRaw =
            formData.get("decisions");

        const decisions = new Map<
            string,
            DocumentImportConflictAction
        >();

        if (typeof decisionsRaw === "string") {
            const parsed = JSON.parse(
                decisionsRaw,
            ) as Record<
                string,
                DocumentImportConflictAction
            >;

            for (const [key, action] of Object.entries(
                parsed,
            )) {
                if (
                    action === "IGNORE" ||
                    action === "REPLACE"
                ) {
                    decisions.set(key, action);
                }
            }
        }

        if (files.length === 0) {
            return NextResponse.json(
                { error: "Aucun fichier fourni." },
                { status: 400 },
            );
        }

        const supportedFormats =
            pipelineCapabilities.import.supportedFormat;

        const importedFiles: ImportedFile[] = [];

        const seenChecksums = new Set<string>();

        for (let index = 0; index < files.length; index++) {
            const file = files[index];
            const relativePath =
                relativePaths[index] || undefined;

            const format = getDocumentFormat(
                file.name,
                file.type,
            );

            if (
                !format ||
                !supportedFormats.includes(format)
            ) {
                continue;
            }

            const checksum =
                await calculateFileChecksumFromStream(
                    file.stream(),
                );

            if (seenChecksums.has(checksum)) {
                continue;
            }

            seenChecksums.add(checksum);

            const key = `${checksum}:${file.name}`;

            const existing =
                await prisma.document.findUnique({
                    where: { checksum },
                    select: {
                        id: true,
                        displayName: true,
                    },
                });

            if (existing) {
                const action =
                    decisions.get(key);

                if (!action) {
                    return NextResponse.json(
                        {
                            error:
                                `Conflit non résolu pour "${file.name}".`,
                        },
                        { status: 409 },
                    );
                }

                if (action === "IGNORE") {
                    continue;
                }
            }

            importedFiles.push({
                file,
                relativePath,
                format,
                checksum,
            });
        }

        if (importedFiles.length === 0) {
            return NextResponse.json({
                importedDocuments: [],
                createdJobIds: [],
                skipped: true,
            });
        }

        const tmpDirectory = path.join(
            os.tmpdir(),
            process.env["TMP_FILE_REPO"] ??
            "bebert-ai-file-repo",
        );

        await mkdir(tmpDirectory, {
            recursive: true,
        });

        const preparedFiles =
            await Promise.all(
                importedFiles.map(
                    async ({
                        file,
                        format,
                        checksum,
                    }) => {
                        const displayName =
                            file.name
                                .replaceAll("\\", "/")
                                .split("/")
                                .pop() ?? file.name;

                        const filename =
                            `${crypto.randomUUID()}_${displayName}`;

                        const filePath = path.join(
                            tmpDirectory,
                            filename,
                        );

                        await writeFile(
                            filePath,
                            Buffer.from(
                                await file.arrayBuffer(),
                            ),
                        );

                        return {
                            filename,
                            displayName,
                            format,
                            checksum,
                            fileSize: file.size,
                        };
                    },
                ),
            );

        const createdJobs: CreatedJob[] = [];

        const documents =
            await prisma.$transaction(
                async (tx) => {
                    const created = [];

                    for (const file of preparedFiles) {
                        const existing =
                            await tx.document.findUnique({
                                where: {
                                    checksum: file.checksum,
                                },
                            });

                        if (existing) {
                            const key = `${file.checksum}:${file.displayName}`;
                            const action =
                                decisions.get(key);

                            if (action !== "REPLACE") {
                                continue;
                            }

                            await tx.document.delete({
                                where: {
                                    id: existing.id,
                                },
                            });
                        }

                        const document =
                            await tx.document.create({
                                data: {
                                    filename: file.filename,
                                    displayName: file.displayName,
                                    format: file.format,
                                    fileSize: file.fileSize,
                                    checksum: file.checksum,
                                    indexingStatus:
                                        indexImmediately
                                            ? "PENDING"
                                            : "UNPLANNED",
                                },
                            });

                        if (indexImmediately) {
                            const indexingJob =
                                await tx.indexingJob.create({
                                    data: {
                                        documentId:
                                            document.id,
                                        status: JobStatus.QUEUED,
                                    },
                                });

                            createdJobs.push({
                                indexingJobId:
                                    indexingJob.id,
                                providerId:
                                    DEFAULT_EMBEDDING_PROVIDER_ID,
                                embeddingModelName:
                                    DEFAULT_EMBEDDING_MODEL,
                            });
                        }

                        created.push(document);
                    }

                    return created;
                },
            );

        if (indexImmediately) {
            const pipelineConfig = await pipelineRuntime.getConfig();

            await Promise.all(
                createdJobs.map((job) => enqueueIndexingJob(job.indexingJobId, pipelineConfig))
            );
        }

        return NextResponse.json({
            importedDocuments: documents,
            createdJobIds: createdJobs.map((job) => job.indexingJobId),
            skipped: false
        });
    } catch (error) {
        console.error(
            "Document import failed:",
            error,
        );

        return NextResponse.json(
            {
                error: "Impossible d'importer les documents.",
            },
            { status: 500 },
        );
    }
}