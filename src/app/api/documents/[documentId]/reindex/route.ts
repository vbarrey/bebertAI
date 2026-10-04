import { NextResponse } from "next/server";
import { JobStatus, IndexingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { enqueueIndexingJob } from "@/lib/queue/indexing";
import { pipelineRuntime } from "@/lib/pipeline/runtime";

type RouteContext = {
    params: Promise<{
        documentId: string;
    }>;
};

type ReindexResponse =
    | { error: string }
    | { indexingJobId: string };

export async function POST(
    _request: Request,
    { params }: RouteContext,
): Promise<NextResponse<ReindexResponse>> {
    const { documentId } = await params;

    try {
        const indexingJob = await prisma.$transaction(
            async (tx) => {
                const document =
                    await tx.document.findUnique({
                        where: {
                            id: documentId,
                        },
                        select: {
                            id: true,
                            indexingStatus: true,
                        },
                    });

                if (!document) {
                    throw new DocumentNotFoundError();
                }

                if (
                    document.indexingStatus ===
                    IndexingStatus.PENDING ||
                    document.indexingStatus ===
                    IndexingStatus.PROCESSING
                ) {
                    throw new DocumentAlreadyIndexingError();
                }

                await tx.chunk.deleteMany({
                    where: {
                        documentId: document.id,
                    },
                });

                await tx.document.update({
                    where: {
                        id: document.id,
                    },
                    data: {
                        indexingStatus:
                            IndexingStatus.PENDING,
                    },
                });

                return tx.indexingJob.create({
                    data: {
                        documentId: document.id,
                        status: JobStatus.QUEUED,
                    },
                });
            },
        );

        const pipelineConfig =
            await pipelineRuntime.getConfig();

        await enqueueIndexingJob(
            indexingJob.id,
            pipelineConfig,
        );

        return NextResponse.json({
            indexingJobId: indexingJob.id,
        });
    } catch (error) {
        if (error instanceof DocumentNotFoundError) {
            return NextResponse.json(
                {
                    error: "Document introuvable.",
                },
                {
                    status: 404,
                },
            );
        }

        if (
            error instanceof DocumentAlreadyIndexingError
        ) {
            return NextResponse.json(
                {
                    error:
                        "Le document est déjà en cours d'indexation.",
                },
                {
                    status: 409,
                },
            );
        }

        console.error(
            `Document reindexing failed (${documentId}):`,
            error,
        );

        return NextResponse.json(
            {
                error: "Impossible de réindexer le document.",
            },
            {
                status: 500,
            },
        );
    }
}

class DocumentNotFoundError extends Error { }

class DocumentAlreadyIndexingError extends Error { }