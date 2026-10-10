import { QueueEvents } from "bullmq";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { createQueueConnection } from "@/lib/queue/redis";
import { indexingQueue } from "@/lib/queue/indexing";

const FINISHED_STATUSES = ["COMPLETED", "FAILED", "CANCELLED"];

/**
 * Streams the status of several indexing jobs over a single SSE connection
 * (one EventSource per job would hit the browser's 6 connections per origin limit).
 * Usage: GET /api/indexing-jobs/events?ids=jobA,jobB
 */
export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .filter(Boolean);

  const jobs = await prisma.indexingJob.findMany({
    where: { id: { in: ids } },
    select: { id: true, documentId: true, status: true, errorMessage: true, document: { select: { displayName: true } } },
  });

  if (jobs.length === 0) {
    return Response.json(
      { error: "Indexing jobs no longer exist" },
      { status: 404 },
    );
  }

  const documentIds = new Map(jobs.map((job) => [job.id, job.documentId]));
  const displayNames = new Map(jobs.map((job) => [job.id, job.document.displayName]));
  const pendingJobIds = new Set(documentIds.keys());

  const encoder = new TextEncoder();

  const queueEvents = new QueueEvents(
    "document-indexing",
    {
      connection: createQueueConnection(),
    },
  );

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (
        event: string,
        data: unknown,
      ) => {
        if (closed) {
          return;
        }

        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          closed = true;
        }
      };

      const cleanup = async () => {
        if (closed) {
          return;
        }

        closed = true;

        queueEvents.off("progress", onProgress);
        queueEvents.off("completed", onCompleted);
        queueEvents.off("failed", onFailed);

        try {
          await queueEvents.close();
        } catch {
          // QueueEvents may already be closed.
        }

        try {
          controller.close();
        } catch {
          // Stream may already be closed.
        }
      };

      const finish = (jobId: string) => {
        pendingJobIds.delete(jobId);

        if (pendingJobIds.size === 0) {
          void cleanup();
        }
      };

      const onProgress = ({ jobId, data }: { jobId: string; data: unknown }) => {
        if (!pendingJobIds.has(jobId)) {
          return;
        }

        send("progress", { jobId, documentId: documentIds.get(jobId), data });
      };

      // returnvalue is what the worker returned, deserialized by BullMQ.
      const onCompleted = ({ jobId, returnvalue }: { jobId: string; returnvalue: unknown }) => {
        if (!pendingJobIds.has(jobId)) {
          return;
        }

        const language = (returnvalue as { language?: string | null } | null)?.language ?? null;

        send("status", { jobId, documentId: documentIds.get(jobId), status: "COMPLETED", language });
        finish(jobId);
      };

      // BullMQ emits "failed" only once retries are exhausted.
      const onFailed = ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
        if (!pendingJobIds.has(jobId)) {
          return;
        }

        send("status", {
          jobId,
          documentId: documentIds.get(jobId),
          displayName: displayNames.get(jobId),
          status: "FAILED",
          errorMessage: failedReason,
        });
        finish(jobId);
      };

      request.signal.addEventListener(
        "abort",
        () => {
          void cleanup();
        },
        { once: true },
      );

      try {
        await queueEvents.waitUntilReady();

        // Last progress of the unfinished jobs: the page may open in the middle of an indexing. Read before
        // subscribing so a progress event that follows is never overwritten by an older snapshot.
        const progressSnapshots = new Map(
          await Promise.all(
            jobs
              .filter((job) => !FINISHED_STATUSES.includes(job.status))
              .map(async (job) => [job.id, (await indexingQueue.getJob(job.id))?.progress] as const),
          ),
        );

        if (closed) {
          return;
        }

        queueEvents.on("progress", onProgress);
        queueEvents.on("completed", onCompleted);
        queueEvents.on("failed", onFailed);

        for (const job of jobs) {
          send("status", { jobId: job.id, documentId: job.documentId, displayName: job.document.displayName, status: job.status, errorMessage: job.errorMessage ?? undefined });

          const progress = progressSnapshots.get(job.id);

          // 0 until the worker reports its first stage.
          if (progress && typeof progress === "object") {
            send("progress", { jobId: job.id, documentId: job.documentId, data: progress });
          }

          if (FINISHED_STATUSES.includes(job.status)) {
            finish(job.id);
          }
        }
      } catch (error) {
        console.error("SSE error for indexing jobs:", ids, error);

        await cleanup();
      }
    },

    async cancel() {
      await queueEvents.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
