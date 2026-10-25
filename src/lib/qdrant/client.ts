import { QdrantClient } from "@qdrant/js-client-rest";

import { env } from "@/lib/env";

const globalForQdrant = globalThis as unknown as {
  qdrant?: QdrantClient;
};

// On globalThis: one client per process, like Prisma's.
export const qdrant = (globalForQdrant.qdrant ??= new QdrantClient({
  url: env.QDRANT_URL,
}));