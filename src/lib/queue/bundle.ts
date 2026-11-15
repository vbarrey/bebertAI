import { Queue } from "bullmq";

import { createRedisConnection } from "./redis";

export const BUNDLE_QUEUE = "bundles";

export type BundleJobData = { bundleJobId: string };

const globalForQueue = globalThis as unknown as { bundleQueue?: Queue<BundleJobData> };

/** Created at its first use: the build imports the actions without Redis. One per process, like the indexing one. */
function getBundleQueue() {
  return (globalForQueue.bundleQueue ??= new Queue<BundleJobData>(BUNDLE_QUEUE, { connection: createRedisConnection() }));
}

/** No retry: a failed export or import tells why, the user starts it again. */
export function enqueueBundleJob(bundleJobId: string) {
  return getBundleQueue().add("bundle", { bundleJobId }, { jobId: bundleJobId, removeOnComplete: true, removeOnFail: true });
}
