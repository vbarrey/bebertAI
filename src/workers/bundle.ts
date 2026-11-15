import { rm } from "node:fs/promises";
import { Worker } from "bullmq";
import { BundleJobKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createRedisConnection } from "@/lib/queue/redis";
import { BUNDLE_QUEUE, type BundleJobData } from "@/lib/queue/bundle";
import { runExportJob } from "@/lib/bundle/export";

const NAME = "Bundle-Worker";

// Exported bundles are kept a day for their download.
const KEEP_MS = 24 * 60 * 60 * 1000;

/** Deletes the bundle files older than a day; their jobs stay listed, without file. */
export async function deleteExpiredBundles(now = new Date()): Promise<void> {
  const expired = await prisma.bundleJob.findMany({
    where: { filePath: { not: null }, createdAt: { lt: new Date(now.getTime() - KEEP_MS) } },
    select: { id: true, filePath: true },
  });

  for (const { id, filePath } of expired) {
    await rm(filePath!, { force: true });
    await prisma.bundleJob.update({ where: { id }, data: { filePath: null } });
  }
}

/** Exports and imports, one at a time: they are long, disk and memory heavy, and rare. */
export function startBundleWorker() {
  const worker = new Worker<BundleJobData>(BUNDLE_QUEUE, async (job) => {
    const bundleJob = await prisma.bundleJob.findUnique({ where: { id: job.data.bundleJobId }, select: { kind: true } });
    if (!bundleJob) return;
    if (bundleJob.kind === BundleJobKind.EXPORT) await runExportJob(job.data.bundleJobId);
  }, { connection: createRedisConnection(), concurrency: 1 });

  worker.on("failed", (job, error) => console.error(`[${NAME}] Job ${job?.id} failed:`, error));
  worker.on("error", (error) => console.error(`[${NAME}] Worker error:`, error));

  const cleanUp = () => deleteExpiredBundles().catch((error) => console.error(`[${NAME}] Cleanup failed:`, error));
  void cleanUp();
  setInterval(cleanUp, 60 * 60 * 1000).unref();

  console.log(`[${NAME}] Started`);
}
