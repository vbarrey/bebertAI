-- CreateTable
CREATE TABLE "EmbeddingCache" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "embedding" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
