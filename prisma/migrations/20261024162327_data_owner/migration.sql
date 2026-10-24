-- The existing projects, conversations and documents go to the first admin (oldest admin account).
-- With data but no admin yet, the migration fails (NOT NULL on userId): create the admin account first.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelId" TEXT,
    CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Conversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Conversation_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AIModel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Conversation" ("userId", "createdAt", "id", "lastMessageAt", "modelId", "projectId", "title", "updatedAt") SELECT (SELECT "id" FROM "User" WHERE "role" = 'admin' ORDER BY "createdAt" LIMIT 1), "createdAt", "id", "lastMessageAt", "modelId", "projectId", "title", "updatedAt" FROM "Conversation";
DROP TABLE "Conversation";
ALTER TABLE "new_Conversation" RENAME TO "Conversation";
CREATE INDEX "Conversation_projectId_lastMessageAt_idx" ON "Conversation"("projectId", "lastMessageAt");
CREATE INDEX "Conversation_userId_lastMessageAt_idx" ON "Conversation"("userId", "lastMessageAt");
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
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
    "indexingStatus" TEXT NOT NULL DEFAULT 'UNPLANNED',
    "ownerProjectId" TEXT,
    CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Document_ownerProjectId_fkey" FOREIGN KEY ("ownerProjectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("userId", "checksum", "createdAt", "displayName", "fileSize", "format", "id", "indexedAt", "indexingStatus", "language", "ownerProjectId", "sourceRef", "sourceType", "storagePath", "updatedAt") SELECT (SELECT "id" FROM "User" WHERE "role" = 'admin' ORDER BY "createdAt" LIMIT 1), "checksum", "createdAt", "displayName", "fileSize", "format", "id", "indexedAt", "indexingStatus", "language", "ownerProjectId", "sourceRef", "sourceType", "storagePath", "updatedAt" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE INDEX "Document_displayName_idx" ON "Document"("displayName");
CREATE INDEX "Document_ownerProjectId_idx" ON "Document"("ownerProjectId");
CREATE UNIQUE INDEX "Document_userId_checksum_key" ON "Document"("userId", "checksum");
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "documentScope" TEXT NOT NULL DEFAULT 'ALL',
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("userId", "createdAt", "description", "documentScope", "id", "name", "updatedAt") SELECT (SELECT "id" FROM "User" WHERE "role" = 'admin' ORDER BY "createdAt" LIMIT 1), "createdAt", "description", "documentScope", "id", "name", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_userId_name_key" ON "Project"("userId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
