/*
  Warnings:

  - You are about to drop the `SourceFolder` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `fileName` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `mimeType` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `relativePath` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `sourceFolderId` on the `Document` table. All the data in the column will be lost.
  - Added the required column `displayName` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `filename` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `format` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "SourceFolder_path_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SourceFolder";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fileSize" INTEGER,
    "checksum" TEXT NOT NULL,
    "language" TEXT,
    "indexedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "indexingStatus" TEXT NOT NULL DEFAULT 'UNPLANNED'
);
INSERT INTO "new_Document" ("checksum", "createdAt", "fileSize", "id", "indexedAt", "indexingStatus", "language", "updatedAt") SELECT "checksum", "createdAt", "fileSize", "id", "indexedAt", "indexingStatus", "language", "updatedAt" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE UNIQUE INDEX "Document_filename_key" ON "Document"("filename");
CREATE UNIQUE INDEX "Document_checksum_key" ON "Document"("checksum");
CREATE INDEX "Document_displayName_idx" ON "Document"("displayName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
