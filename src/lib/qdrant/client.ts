import "dotenv/config";

import { QdrantClient } from "@qdrant/js-client-rest";

const globalForQdrant = globalThis as unknown as {
  qdrant?: QdrantClient;
};

export const qdrant =
  globalForQdrant.qdrant ??
  new QdrantClient({
    url: process.env["QDRANT_URL"] ?? "http://localhost:6333",
  });

if (process.env.NODE_ENV !== "production") {
  globalForQdrant.qdrant = qdrant;
}