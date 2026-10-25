import "dotenv/config";

import { QdrantClient } from "@qdrant/js-client-rest";

const globalForQdrant = globalThis as unknown as {
  qdrant?: QdrantClient;
};

// On globalThis: one client per process, like Prisma's.
export const qdrant = (globalForQdrant.qdrant ??= new QdrantClient({
  url: process.env["QDRANT_URL"] ?? "http://localhost:6333",
}));