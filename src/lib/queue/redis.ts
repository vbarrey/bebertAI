import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

export function createQueueConnection() {
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });
}

export function createWorkerConnection() {
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });
}
