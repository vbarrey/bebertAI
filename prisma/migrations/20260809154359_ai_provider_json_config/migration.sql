/*
  Warnings:

  - Added the required column `configuration` to the `AIProvider` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AIProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "configuration" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "defaultModelId" TEXT,
    CONSTRAINT "AIProvider_defaultModelId_fkey" FOREIGN KEY ("defaultModelId") REFERENCES "AIModel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AIProvider" ("createdAt", "defaultModelId", "enabled", "id", "isDefault", "name", "type", "updatedAt") SELECT "createdAt", "defaultModelId", "enabled", "id", "isDefault", "name", "type", "updatedAt" FROM "AIProvider";
DROP TABLE "AIProvider";
ALTER TABLE "new_AIProvider" RENAME TO "AIProvider";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
