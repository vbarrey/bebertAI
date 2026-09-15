/*
  Warnings:

  - You are about to drop the column `mimeType` on the `Document` table. All the data in the column will be lost.
  - Added the required column `format` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceFolderId" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fileSize" INTEGER,
    "checksum" TEXT NOT NULL,
    "language" TEXT,
    "indexedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "indexingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "Document_sourceFolderId_fkey" FOREIGN KEY ("sourceFolderId") REFERENCES "SourceFolder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("checksum", "createdAt", "fileName", "fileSize", "id", "indexedAt", "indexingStatus", "language", "relativePath", "sourceFolderId", "updatedAt") SELECT "checksum", "createdAt", "fileName", "fileSize", "id", "indexedAt", "indexingStatus", "language", "relativePath", "sourceFolderId", "updatedAt" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE INDEX "Document_sourceFolderId_idx" ON "Document"("sourceFolderId");
CREATE UNIQUE INDEX "Document_sourceFolderId_relativePath_key" ON "Document"("sourceFolderId", "relativePath");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
