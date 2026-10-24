import { Document, DocumentSourceType, JobStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { pipelineRuntime } from "@/lib/pipeline/runtime";
import { createDocument } from "@/lib/mutations/document";
import { deleteDocumentFile } from "@/lib/documents/storage";
import { deleteDocumentEmbeddings } from "@/lib/qdrant/points";
import { enqueueIndexingJob } from "@/lib/queue/indexing";

import type { DocumentFormat } from "@/lib/documents/format";
import type { DocumentImportConflictAction } from "@/types/document-import";

/**
 * A document ready to be created, whatever its source. `storagePath` is its stored copy, null when the
 * file stays at its source (`sourceRef`).
 */
export type DocumentToImport = {
    id: string;
    storagePath: string | null;
    displayName: string;
    format: DocumentFormat;
    checksum: string;
    fileSize: number;
    sourceType: DocumentSourceType;
    sourceRef: string | null;
};

type PersistResult = {
    documents: Document[];
    createdJobIds: string[];
    replacedStoragePaths: string[];
    replacedDocumentIds: string[];
    skippedStoragePaths: string[];
};

// Key of a conflict decision, as built by the import analysis.
export function getImportDecisionKey(checksum: string, displayName: string) {
    return `${checksum}:${displayName}`;
}

async function persistDocuments(
    userId: string,
    files: DocumentToImport[],
    decisions: Map<string, DocumentImportConflictAction>,
    indexImmediately: boolean,
    projectId: string | null,
): Promise<PersistResult> {
    return prisma.$transaction(async (tx) => {
        const documents: Document[] = [];
        const createdJobIds: string[] = [];
        const replacedStoragePaths: string[] = [];
        const replacedDocumentIds: string[] = [];
        const skippedStoragePaths: string[] = [];

        for (const file of files) {
            const existing = await tx.document.findUnique({
                where: {
                    userId_checksum: { userId, checksum: file.checksum },
                },
                select: {
                    id: true,
                    storagePath: true,
                    ownerProjectId: true,
                    projects: { select: { projectId: true } },
                },
            });

            // Imported from a project: the document already there joins its selection instead of a copy.
            const joinsProject = projectId !== null && existing !== null && existing.ownerProjectId !== projectId;

            if (existing) {
                const action = decisions.get(
                    getImportDecisionKey(file.checksum, file.displayName),
                );

                if (action !== "REPLACE") {
                    if (file.storagePath) {
                        skippedStoragePaths.push(
                            file.storagePath,
                        );
                    }

                    if (joinsProject) {
                        await tx.projectDocument.upsert({
                            where: { projectId_documentId: { projectId, documentId: existing.id } },
                            create: { projectId, documentId: existing.id },
                            update: {},
                        });
                    }

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
                userId,
                storagePath: file.storagePath,
                displayName: file.displayName,
                format: file.format,
                fileSize: file.fileSize,
                checksum: file.checksum,
                sourceType: file.sourceType,
                sourceRef: file.sourceRef,
                indexingStatus: indexImmediately
                    ? "PENDING"
                    : "UNPLANNED",
                // A replaced document stays where it was: in the library or in its project.
                ownerProjectId: existing ? existing.ownerProjectId : projectId,
            }, tx);

            // The selections of the replaced document, and the importing project, keep the new one.
            const selectedBy = [
                ...(existing?.projects.map((link) => link.projectId) ?? []),
                ...(joinsProject && !existing.projects.some((link) => link.projectId === projectId) ? [projectId] : []),
            ];

            if (selectedBy.length > 0) {
                await tx.projectDocument.createMany({
                    data: selectedBy.map((selecting) => ({ projectId: selecting, documentId: document.id })),
                });
            }

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

/**
 * Creates the documents, replacing or skipping the existing ones with the same checksum as decided,
 * then queues their indexing. The stored copies of the files are deleted when the creation fails.
 */
export async function importDocuments(
    // The owner of the documents; a checksum already in their documents is a conflict. The routes check that the
    // project is theirs.
    userId: string,
    files: DocumentToImport[],
    decisions: Map<string, DocumentImportConflictAction>,
    indexImmediately: boolean,
    // Imported from this project: the new documents are its own, those already there join its selection.
    projectId: string | null = null,
): Promise<{ documents: Document[]; createdJobIds: string[] }> {
    let result: PersistResult;

    try {
        result = await persistDocuments(
            userId,
            files,
            decisions,
            indexImmediately,
            projectId,
        );
    } catch (error) {
        await Promise.allSettled(
            files.map((file) =>
                deleteDocumentFile(file.storagePath),
            ),
        );

        throw error;
    }

    /*
     * Files that were stored before the transaction but were
     * skipped because another request imported the same checksum
     * in the meantime are no longer needed.
     *
     * The old file is no longer referenced by the database after
     * a replacement. It can therefore be deleted only after the
     * transaction has successfully committed.
     */
    await Promise.allSettled(
        [
            ...result.skippedStoragePaths,
            ...result.replacedStoragePaths,
        ].map((storagePath) =>
            deleteDocumentFile(storagePath),
        ),
    );

    await Promise.allSettled(
        result.replacedDocumentIds.map(
            (documentId) =>
                deleteDocumentEmbeddings(documentId),
        ),
    );

    if (result.createdJobIds.length > 0) {
        const pipelineConfig =
            await pipelineRuntime.getConfig();

        await Promise.all(
            result.createdJobIds.map(
                (jobId) =>
                    enqueueIndexingJob(
                        jobId,
                        pipelineConfig,
                    ),
            ),
        );
    }

    return {
        documents: result.documents,
        createdJobIds: result.createdJobIds,
    };
}
