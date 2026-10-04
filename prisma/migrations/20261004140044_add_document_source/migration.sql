/*
  Warnings:

  - You are about to drop the column `filename` on the `Document` table. All the data in the column will be lost.
  - Added the required column `sourceType` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fileSize" INTEGER,
    "checksum" TEXT NOT NULL,
    "language" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceRef" TEXT,
    "storagePath" TEXT,
    "indexedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "indexingStatus" TEXT NOT NULL DEFAULT 'UNPLANNED'
);
INSERT INTO "new_Document" ("checksum", "createdAt", "displayName", "fileSize", "format", "id", "indexedAt", "indexingStatus", "language", "updatedAt") SELECT "checksum", "createdAt", "displayName", "fileSize", "format", "id", "indexedAt", "indexingStatus", "language", "updatedAt" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE UNIQUE INDEX "Document_checksum_key" ON "Document"("checksum");
CREATE INDEX "Document_displayName_idx" ON "Document"("displayName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
