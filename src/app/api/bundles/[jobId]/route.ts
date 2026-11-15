import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { BundleJobKind, JobStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { apiUser } from "@/lib/session";

// Streams the file from the disk.
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ jobId: string }> };

/** Downloads the bundle of one of the user's exports, as a stream: it may weigh gigabytes. */
export async function GET(_request: Request, { params }: RouteContext) {
    const { user, error } = await apiUser();
    if (error) return error;

    const { jobId } = await params;
    const job = await prisma.bundleJob.findFirst({
        where: { id: jobId, userId: user.id, kind: BundleJobKind.EXPORT, status: JobStatus.COMPLETED, filePath: { not: null } },
        select: { filePath: true, fileSize: true, createdAt: true },
    });
    if (!job) return NextResponse.json({ error: "Export introuvable ou expiré." }, { status: 404 });

    const name = `bebert-${job.createdAt.toISOString().slice(0, 10)}.bebert`;

    return new Response(Readable.toWeb(createReadStream(job.filePath!)) as ReadableStream, {
        headers: {
            "Content-Type": "application/octet-stream",
            "Content-Length": String(job.fileSize),
            "Content-Disposition": `attachment; filename="${name}"`,
        },
    });
}
