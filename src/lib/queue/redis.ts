import IORedis from "ioredis";
import { env } from "@/lib/env";

// BullMQ's workers and queue events block on their connection: each one gets its own.
export function createRedisConnection() {
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}
