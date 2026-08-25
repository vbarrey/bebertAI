/*
  Warnings:

  - You are about to alter the column `height` on the `Chunk` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.
  - You are about to alter the column `width` on the `Chunk` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.
  - You are about to alter the column `x` on the `Chunk` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.
  - You are about to alter the column `y` on the `Chunk` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.

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
    "x" REAL,
    "y" REAL,
    "width" REAL,
    "height" REAL,
    CONSTRAINT "Chunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Chunk" ("documentId", "height", "id", "pageNumber", "position", "text", "width", "x", "y") SELECT "documentId", "height", "id", "pageNumber", "position", "text", "width", "x", "y" FROM "Chunk";
DROP TABLE "Chunk";
ALTER TABLE "new_Chunk" RENAME TO "Chunk";
CREATE INDEX "Chunk_documentId_position_idx" ON "Chunk"("documentId", "position");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
