-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AIModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "sizeBytes" BIGINT,
    "parameterSize" TEXT,
    "family" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "requiresCredits" BOOLEAN,
    CONSTRAINT "AIModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AIProvider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AIModel" ("createdAt", "description", "displayName", "enabled", "family", "favorite", "id", "name", "parameterSize", "providerId", "requiresCredits", "sizeBytes", "updatedAt") SELECT "createdAt", "description", "displayName", "enabled", "family", "favorite", "id", "name", "parameterSize", "providerId", "requiresCredits", "sizeBytes", "updatedAt" FROM "AIModel";
DROP TABLE "AIModel";
ALTER TABLE "new_AIModel" RENAME TO "AIModel";
CREATE UNIQUE INDEX "AIModel_providerId_name_key" ON "AIModel"("providerId", "name");
CREATE TABLE "new_AIProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "configuration" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "defaultModelId" TEXT,
    CONSTRAINT "AIProvider_defaultModelId_fkey" FOREIGN KEY ("defaultModelId") REFERENCES "AIModel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- The source moves from the models to their provider: Ollama local runs its models locally, the other types remotely.
INSERT INTO "new_AIProvider" ("configuration", "createdAt", "defaultModelId", "enabled", "id", "isDefault", "name", "type", "source", "updatedAt") SELECT "configuration", "createdAt", "defaultModelId", "enabled", "id", "isDefault", "name", "type", CASE WHEN "type" = 'OLLAMA_LOCAL' THEN 'LOCAL' ELSE 'REMOTE' END, "updatedAt" FROM "AIProvider";
DROP TABLE "AIProvider";
ALTER TABLE "new_AIProvider" RENAME TO "AIProvider";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

