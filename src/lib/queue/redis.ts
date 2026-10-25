import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

// BullMQ's workers and queue events block on their connection: each one gets its own.
export function createRedisConnection() {
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });
}
