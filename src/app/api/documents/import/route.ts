import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { Document } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { pipelineCapabilities } from "@/lib/pipeline/capabilities";

import { getDocumentFormat, DocumentFormat } from "@/lib/documents/format";
import {
    calculateFileChecksumFromStream,
} from "@/lib/documents/checksum";
import {
    storeDocumentFile,
    deleteDocumentFile,
} from "@/lib/documents/storage";
import {
    DocumentToImport,
    addToProjectSelection,
    getImportDecisionKey,
    importDocuments,
} from "@/lib/documents/import";

import type {
    DocumentImportConflictAction,
} from "@/types/document-import";
import { apiUser } from "@/lib/session";

type ImportedFile = {
    file: File;
    format: DocumentFormat;
    checksum: string;
};

type PreparedFile = DocumentToImport & {
    storagePath: string;
    data: Buffer;
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
    userId: string,
    files: File[],
    decisions: Map<string, DocumentImportConflictAction>,
    // Filled with the documents already there that the files were not imported over.
    keptExistingIds: string[],
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
                userId_checksum: { userId, checksum },
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

        const action = decisions.get(
            getImportDecisionKey(checksum, file.name),
        );

        if (!action) {
            throw new ImportConflictError(
                `Conflit non résolu pour "${file.name}".`,
            );
        }

        if (action === "IGNORE") {
            keptExistingIds.push(existing.id);
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
                sourceType: "LOCAL" as const,
                sourceRef: null,
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

class ImportConflictError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ImportConflictError";
    }
}

export async function POST(
    request: Request,
): Promise<NextResponse<ImportResponse>> {
    const { user, error: authError } = await apiUser();
    if (authError) return authError;

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
        const keptExistingIds: string[] = [];
        const projectId = formData.get("projectId")?.toString() || null;

        try {
            importedFiles = await prepareImportedFiles(
                user.id,
                files,
                decisions,
                keptExistingIds,
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

        // Imported from a project: the documents already there join its selection instead of a copy.
        if (projectId && keptExistingIds.length > 0) {
            await addToProjectSelection(projectId, keptExistingIds);
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

        const importResult = await importDocuments(
            user.id,
            preparedFiles,
            decisions,
            indexImmediately,
            projectId,
        );

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