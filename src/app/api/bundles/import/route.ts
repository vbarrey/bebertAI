import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import path from "node:path";
import { NextResponse } from "next/server";
import { BundleJobKind } from "@prisma/client";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { apiUser } from "@/lib/session";
import { enqueueBundleJob } from "@/lib/queue/bundle";
import { BUNDLE_EXTENSION } from "@/lib/bundle/format";
import { MAX_BUNDLE_SIZE } from "@/lib/bundle/limits";

// Streams the body to the disk.
export const runtime = "nodejs";

const tooLarge = () => NextResponse.json({ error: `Paquet trop volumineux (${MAX_BUNDLE_SIZE / 1000 ** 3} Go au plus).` }, { status: 413 });

/**
 * Receives a .bebert bundle as the raw body (it may weigh gigabytes: never in memory), then queues its import.
 * Out of the proxy matcher, which would keep only its first 10 MB. The worker checks everything in it.
 */
export async function POST(request: Request) {
    const { user, error } = await apiUser();
    if (error) return error;

    if (Number(request.headers.get("content-length") ?? 0) > MAX_BUNDLE_SIZE) return tooLarge();
    if (!request.body) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });

    let name = "paquet.bebert";
    try {
        name = decodeURIComponent(request.headers.get("x-file-name") ?? name).slice(0, 200);
    } catch {
        // A name the browser did not encode: the default one.
    }
    const job = await prisma.bundleJob.create({
        data: { userId: user.id, kind: BundleJobKind.IMPORT, parameters: {}, label: name },
    });
    const file = path.join(/*turbopackIgnore: true*/ env.BUNDLES_PATH, `${job.id}${BUNDLE_EXTENSION}`);

    // A body without Content-Length (chunked) is counted as it comes.
    let received = 0;
    const limit = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            received += chunk.length;
            callback(received > MAX_BUNDLE_SIZE ? new Error("too large") : null, chunk);
        },
    });

    try {
        await mkdir(env.BUNDLES_PATH, { recursive: true });
        await pipeline(Readable.fromWeb(request.body as NodeReadableStream<Uint8Array>), limit, createWriteStream(file));
    } catch {
        await rm(file, { force: true });
        await prisma.bundleJob.delete({ where: { id: job.id } });
        return received > MAX_BUNDLE_SIZE ? tooLarge() : NextResponse.json({ error: "Envoi interrompu : réessayez." }, { status: 400 });
    }

    await prisma.bundleJob.update({ where: { id: job.id }, data: { filePath: file, fileSize: received } });
    await enqueueBundleJob(job.id);

    return NextResponse.json({ jobId: job.id });
}
