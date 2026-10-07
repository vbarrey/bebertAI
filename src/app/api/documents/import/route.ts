import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { Document, JobStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { pipelineCapabilities } from "@/lib/pipeline/capabilities";
import { pipelineRuntime } from "@/lib/pipeline/runtime";

import { getDocumentFormat, DocumentFormat } from "@/lib/documents/format";
import {
    calculateFileChecksumFromStream,
} from "@/lib/documents/checksum";
import {
    storeDocumentFile,
    deleteDocumentFile,
} from "@/lib/documents/storage";
import { deleteDocumentEmbeddings } from "@/lib/qdrant/points";

import { enqueueIndexingJob } from "@/lib/queue/indexing";

import type {
    DocumentImportConflictAction,
} from "@/types/document-import";
import { createDocument } from "@/lib/mutations/document";

type ImportedFile = {
    file: File;
    format: DocumentFormat;
    checksum: string;
};

type PreparedFile = {
    id: string;
    storagePath: string;
    displayName: string;
    format: DocumentFormat;
    checksum: string;
    fileSize: number;
    data: Buffer;
};

type ImportResult = {
    documents: Document[];
    createdJobIds: string[];
    replacedStoragePaths: string[];
    replacedDocumentIds: string[];
    skippedStoragePaths: string[];
};

type ImportResponse =
    | {
        error: string;
    }
    | {
        importedDocuments: Document[];
        createdJobIds: string[];
        skipped: boolean;
    };

function parseConflictDecisions(
    value: FormDataEntryValue | null,
): Map<string, DocumentImportConflictAction> {
    const decisions = new Map<
        string,
        DocumentImportConflictAction
    >();

    if (typeof value !== "string" || !value) {
        return decisions;
    }

    const parsed = JSON.parse(value) as Record<
        string,
        DocumentImportConflictAction
    >;

    for (const [key, action] of Object.entries(parsed)) {
        if (action === "IGNORE" || action === "REPLACE") {
            decisions.set(key, action);
        }
    }

    return decisions;
}

async function prepareImportedFiles(
    files: File[],
    decisions: Map<string, DocumentImportConflictAction>,
): Promise<ImportedFile[]> {
    const supportedFormats =
        pipelineCapabilities.import.supportedFormat;

    const importedFiles: ImportedFile[] = [];
    const seenChecksums = new Set<string>();

    for (const file of files) {
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

        const existing = await prisma.document.findUnique({
            where: {
                checksum,
            },
            select: {
                id: true,
                displayName: true,
            },
        });

        if (!existing) {
            importedFiles.push({
                file,
                format,
                checksum,
            });

            continue;
        }

        const key = `${checksum}:${file.name}`;
        const action = decisions.get(key);

        if (!action) {
            throw new ImportConflictError(
                `Conflit non résolu pour "${file.name}".`,
            );
        }

        if (action === "IGNORE") {
            continue;
        }

        importedFiles.push({
            file,
            format,
            checksum,
        });
    }

    return importedFiles;
}

async function prepareFiles(
    importedFiles: ImportedFile[],
): Promise<PreparedFile[]> {
    return Promise.all(
        importedFiles.map(async ({ file, format, checksum }) => {
            const documentId = crypto.randomUUID();

            return {
                id: documentId,
                storagePath: documentId,
                displayName: file.name,
                format,
                checksum,
                fileSize: file.size,
                data: Buffer.from(
                    await file.arrayBuffer(),
                ),
            };
        }),
    );
}

async function storePreparedFiles(
    files: PreparedFile[],
): Promise<string[]> {
    const storedPaths: string[] = [];

    try {
        for (const file of files) {
            await storeDocumentFile(
                file.storagePath,
                file.data,
            );

            storedPaths.push(file.storagePath);
        }

        return storedPaths;
    } catch (error) {
        await Promise.allSettled(
            storedPaths.map((storagePath) =>
                deleteDocumentFile(storagePath),
            ),
        );

        throw error;
    }
}

async function persistDocuments(
    files: PreparedFile[],
    decisions: Map<string, DocumentImportConflictAction>,
    indexImmediately: boolean,
): Promise<ImportResult> {
    return prisma.$transaction(async (tx) => {
        const documents: Document[] = [];
        const createdJobIds: string[] = [];
        const replacedStoragePaths: string[] = [];
        const replacedDocumentIds: string[] = [];
        const skippedStoragePaths: string[] = [];

        for (const file of files) {
            const existing = await tx.document.findUnique({
                where: {
                    checksum: file.checksum,
                },
                select: {
                    id: true,
                    storagePath: true,
                },
            });

            if (existing) {
                const key =
                    `${file.checksum}:${file.displayName}`;

                const action = decisions.get(key);

                if (action !== "REPLACE") {
                    skippedStoragePaths.push(
                        file.storagePath,
                    );

                    continue;
                }

                await tx.document.delete({
                    where: {
                        id: existing.id,
                    },
                });

                replacedDocumentIds.push(existing.id);

                if (existing.storagePath) {
                    replacedStoragePaths.push(
                        existing.storagePath,
                    );
                }
            }

            const document = await createDocument({
                id: file.id,
                storagePath: file.storagePath,
                displayName: file.displayName,
                format: file.format,
                fileSize: file.fileSize,
                checksum: file.checksum,
                sourceType: "LOCAL",
                sourceRef: null,
                indexingStatus: indexImmediately
                    ? "PENDING"
                    : "UNPLANNED",
            }, tx);

            documents.push(document);

            if (!indexImmediately) {
                continue;
            }

            const indexingJob =
                await tx.indexingJob.create({
                    data: {
                        documentId: document.id,
                        status: JobStatus.QUEUED,
                    },
                });

            createdJobIds.push(indexingJob.id);
        }

        return {
            documents,
            createdJobIds,
            replacedStoragePaths,
            replacedDocumentIds,
            skippedStoragePaths,
        };
    });
}

class ImportConflictError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ImportConflictError";
    }
}

export async function POST(
    request: Request,
): Promise<NextResponse<ImportResponse>> {
    try {
        const formData = await request.formData();

        const files = formData
            .getAll("files")
            .filter(
                (entry): entry is File =>
                    entry instanceof File,
            );

        if (files.length === 0) {
            return NextResponse.json(
                {
                    error: "Aucun fichier fourni.",
                },
                {
                    status: 400,
                },
            );
        }

        const indexImmediately =
            formData.get("indexImmediately") === "true";

        let decisions: Map<
            string,
            DocumentImportConflictAction
        >;

        try {
            decisions = parseConflictDecisions(
                formData.get("decisions"),
            );
        } catch {
            return NextResponse.json(
                {
                    error: "Les décisions de conflit sont invalides.",
                },
                {
                    status: 400,
                },
            );
        }

        let importedFiles: ImportedFile[];

        try {
            importedFiles = await prepareImportedFiles(
                files,
                decisions,
            );
        } catch (error) {
            if (error instanceof ImportConflictError) {
                return NextResponse.json(
                    {
                        error: error.message,
                    },
                    {
                        status: 409,
                    },
                );
            }

            throw error;
        }

        if (importedFiles.length === 0) {
            return NextResponse.json({
                importedDocuments: [],
                createdJobIds: [],
                skipped: true,
            });
        }

        const preparedFiles =
            await prepareFiles(importedFiles);

        await storePreparedFiles(preparedFiles);

        let importResult: ImportResult;

        try {
            importResult = await persistDocuments(
                preparedFiles,
                decisions,
                indexImmediately,
            );
        } catch (error) {
            await Promise.allSettled(
                preparedFiles.map((file) =>
                    deleteDocumentFile(
                        file.storagePath,
                    ),
                ),
            );

            throw error;
        }

        /*
         * Files that were stored before the transaction but were
         * skipped because another request imported the same checksum
         * in the meantime are no longer needed.
         */
        if (
            importResult.skippedStoragePaths.length > 0
        ) {
            await Promise.allSettled(
                importResult.skippedStoragePaths.map(
                    (storagePath) =>
                        deleteDocumentFile(storagePath),
                ),
            );
        }

        /*
         * The old file is no longer referenced by the database after
         * a replacement. It can therefore be deleted only after the
         * transaction has successfully committed.
         */
        if (
            importResult.replacedStoragePaths.length > 0
        ) {
            await Promise.allSettled(
                importResult.replacedStoragePaths.map(
                    (storagePath) =>
                        deleteDocumentFile(storagePath),
                ),
            );
        }

        await Promise.allSettled(
            importResult.replacedDocumentIds.map(
                (documentId) =>
                    deleteDocumentEmbeddings(documentId),
            ),
        );

        if (importResult.createdJobIds.length > 0) {
            const pipelineConfig =
                await pipelineRuntime.getConfig();

            await Promise.all(
                importResult.createdJobIds.map(
                    (jobId) =>
                        enqueueIndexingJob(
                            jobId,
                            pipelineConfig,
                        ),
                ),
            );
        }

        return NextResponse.json({
            importedDocuments: importResult.documents,
            createdJobIds: importResult.createdJobIds,
            skipped: false,
        });
    } catch (error) {
        console.error(
            "Document import failed:",
            error,
        );

        return NextResponse.json(
            {
                error:
                    "Impossible d'importer les documents.",
            },
            {
                status: 500,
            },
        );
    }
}