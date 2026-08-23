/*
  Warnings:

  - You are about to drop the column `kind` on the `IndexingJob` table. All the data in the column will be lost.
  - You are about to drop the column `processedCount` on the `IndexingJob` table. All the data in the column will be lost.
  - You are about to drop the column `sourceFolderId` on the `IndexingJob` table. All the data in the column will be lost.
  - You are about to drop the column `totalCount` on the `IndexingJob` table. All the data in the column will be lost.
  - Added the required column `position` to the `Chunk` table without a default value. This is not possible if the table is not empty.
  - Added the required column `documentId` to the `IndexingJob` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Chunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "x" INTEGER,
    "y" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    CONSTRAINT "Chunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Chunk" ("documentId", "height", "id", "pageNumber", "text", "width", "x", "y") SELECT "documentId", "height", "id", "pageNumber", "text", "width", "x", "y" FROM "Chunk";
DROP TABLE "Chunk";
ALTER TABLE "new_Chunk" RENAME TO "Chunk";
CREATE INDEX "Chunk_documentId_position_idx" ON "Chunk"("documentId", "position");
CREATE TABLE "new_IndexingJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IndexingJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_IndexingJob" ("createdAt", "errorMessage", "finishedAt", "id", "startedAt", "status") SELECT "createdAt", "errorMessage", "finishedAt", "id", "startedAt", "status" FROM "IndexingJob";
DROP TABLE "IndexingJob";
ALTER TABLE "new_IndexingJob" RENAME TO "IndexingJob";
CREATE INDEX "IndexingJob_documentId_createdAt_idx" ON "IndexingJob"("documentId", "createdAt");
CREATE INDEX "IndexingJob_status_createdAt_idx" ON "IndexingJob"("status", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
