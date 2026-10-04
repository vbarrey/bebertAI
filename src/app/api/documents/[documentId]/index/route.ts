import { NextResponse } from "next/server";
import { JobStatus, IndexingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { enqueueIndexingJob } from "@/lib/queue/indexing";
import { pipelineRuntime } from "@/lib/pipeline/runtime";

const INDEXABLE_STATUSES: IndexingStatus[] = [
    IndexingStatus.UNPLANNED,
    IndexingStatus.FAILED,
    IndexingStatus.CANCELLED,
];

type RouteContext = {
    params: Promise<{
        documentId: string;
    }>;
};

type IndexResponse =
    | { error: string }
    | {
        indexingJobId: string;
    }

export async function POST(
    _request: Request,
    { params }: RouteContext,
): Promise<NextResponse<IndexResponse>> {
    const { documentId } = await params;

    try {
        const document = await prisma.document.findUnique({
            where: {
                id: documentId,
            },
            select: {
                id: true,
                indexingStatus: true,
            },
        });

        if (!document) {
            return NextResponse.json(
                {
                    error: "Document introuvable.",
                },
                {
                    status: 404,
                },
            );
        }

        if (!INDEXABLE_STATUSES.includes(document.indexingStatus)) {
            return NextResponse.json(
                {
                    error:
                        "Ce document ne peut pas être indexé dans son état actuel. Essayer de le ré-indexer.",
                },
                {
                    status: 409,
                },
            );
        }

        const indexingJob = await prisma.$transaction(
            async (tx) => {
                const job = await tx.indexingJob.create({
                    data: {
                        documentId: document.id,
                        status: JobStatus.QUEUED,
                    },
                });

                await tx.document.update({
                    where: {
                        id: document.id,
                    },
                    data: {
                        indexingStatus: IndexingStatus.PENDING,
                    },
                });

                return job;
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
        console.error(
            `Document indexing failed (${documentId}):`,
            error,
        );

        return NextResponse.json(
            {
                error: "Impossible de lancer l'indexation.",
            },
            {
                status: 500,
            },
        );
    }
}