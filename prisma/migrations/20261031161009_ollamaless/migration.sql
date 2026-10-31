/*
  Warnings:

  - Made the column `userId` on table `AIProvider` required. This step will fail if there are existing NULL values in that column.

*/
-- Ollama local is gone: its models, and the providers without owner nobody could see.
UPDATE "Conversation" SET "modelId" = NULL WHERE "modelId" IN (SELECT "m"."id" FROM "AIModel" "m" JOIN "AIProvider" "p" ON "m"."providerId" = "p"."id" WHERE "p"."type" = 'OLLAMA_LOCAL' OR "p"."userId" IS NULL);
UPDATE "AIProvider" SET "defaultModelId" = NULL WHERE "type" = 'OLLAMA_LOCAL' OR "userId" IS NULL;
DELETE FROM "_AIModelToAIModelCapability" WHERE "A" IN (SELECT "m"."id" FROM "AIModel" "m" JOIN "AIProvider" "p" ON "m"."providerId" = "p"."id" WHERE "p"."type" = 'OLLAMA_LOCAL' OR "p"."userId" IS NULL);
DELETE FROM "AIModel" WHERE "providerId" IN (SELECT "id" FROM "AIProvider" WHERE "type" = 'OLLAMA_LOCAL' OR "userId" IS NULL);
DELETE FROM "AIProvider" WHERE "type" = 'OLLAMA_LOCAL' OR "userId" IS NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "onboardedAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AIProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "configuration" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "defaultModelId" TEXT,
    CONSTRAINT "AIProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AIProvider_defaultModelId_fkey" FOREIGN KEY ("defaultModelId") REFERENCES "AIModel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AIProvider" ("configuration", "createdAt", "defaultModelId", "enabled", "id", "isDefault", "name", "source", "type", "updatedAt", "userId") SELECT "configuration", "createdAt", "defaultModelId", "enabled", "id", "isDefault", "name", "source", "type", "updatedAt", "userId" FROM "AIProvider";
DROP TABLE "AIProvider";
ALTER TABLE "new_AIProvider" RENAME TO "AIProvider";
CREATE INDEX "AIProvider_userId_idx" ON "AIProvider"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
