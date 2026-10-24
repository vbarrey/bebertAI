-- The providers added with an API key go to the first admin (oldest admin account); Ollama local stays shared (null).
-- Without any admin, they keep a null owner: only Ollama local counts as shared, so nobody sees them.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AIProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
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
INSERT INTO "new_AIProvider" ("userId", "configuration", "createdAt", "defaultModelId", "enabled", "id", "isDefault", "name", "source", "type", "updatedAt") SELECT CASE WHEN "type" = 'OLLAMA_LOCAL' THEN NULL ELSE (SELECT "id" FROM "User" WHERE "role" = 'admin' ORDER BY "createdAt" LIMIT 1) END, "configuration", "createdAt", "defaultModelId", "enabled", "id", "isDefault", "name", "source", "type", "updatedAt" FROM "AIProvider";
DROP TABLE "AIProvider";
ALTER TABLE "new_AIProvider" RENAME TO "AIProvider";
CREATE INDEX "AIProvider_userId_idx" ON "AIProvider"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
