import { QueueEvents } from "bullmq";
import { NextRequest } from "next/server";

import { createQueueConnection } from "@/lib/queue/redis";
import { getIndexingJobById } from "@/lib/queries/indexing-job";

type Params = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(
  request: NextRequest,
  { params }: Params,
) {
  const { jobId } = await params;

  const currentJob = await getIndexingJobById(jobId);

  if (!currentJob) {
    return new Response(
      JSON.stringify({
        error: "Indexing job no longer exists",
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

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

        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
          ),
        );
      };

      const cleanup = async () => {
        if (closed) {
          return;
        }

        closed = true;

        queueEvents.off(
          "progress",
          onProgress,
        );

        queueEvents.off(
          "completed",
          onCompleted,
        );

        queueEvents.off(
          "failed",
          onFailed,
        );

        await queueEvents.close();

        try {
          controller.close();
        } catch {
          // Stream already closed.
        }
      };

      const onProgress = ({
        jobId: eventJobId,
        data,
      }: {
        jobId: string;
        data: unknown;
      }) => {
        if (eventJobId !== jobId) {
          return;
        }

        send("progress", data);
      };

      const onCompleted = ({
        jobId: eventJobId,
      }: {
        jobId: string;
      }) => {
        if (eventJobId !== jobId) {
          return;
        }

        send("status", {
          documentId: currentJob.documentId,
          status: "COMPLETED",
        });

        send("completed", {
          documentId: currentJob.documentId,
          status: "COMPLETED",
        });

        void cleanup();
      };

      const onFailed = ({
        jobId: eventJobId,
        failedReason,
      }: {
        jobId: string;
        failedReason: string;
      }) => {
        if (eventJobId !== jobId) {
          return;
        }

        send("status", {
          documentId: currentJob.documentId,
          status: "FAILED",
        });

        send("failed", {
          documentId: currentJob.documentId,
          status: "FAILED",
          errorMessage: failedReason,
        });

        void cleanup();
      };

      try {
        await queueEvents.waitUntilReady();

        queueEvents.on(
          "progress",
          onProgress,
        );

        queueEvents.on(
          "completed",
          onCompleted,
        );

        queueEvents.on(
          "failed",
          onFailed,
        );

        send("status", {
          documentId: currentJob.documentId,
          status: currentJob.status,
        });

        if (
          currentJob.status === "COMPLETED" ||
          currentJob.status === "FAILED" ||
          currentJob.status === "CANCELLED"
        ) {
          await cleanup();
        }
      } catch (error) {
        console.error(
          `SSE error: "${jobId}"`,
          error,
        );

        await cleanup();
      }
    },

    async cancel() {
      await queueEvents.close();
    },
  });

  request.signal.addEventListener(
    "abort",
    () => {
      void queueEvents.close();
    },
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}