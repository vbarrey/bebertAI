-- CreateTable
CREATE TABLE "ProjectDocument" (
    "projectId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("projectId", "documentId"),
    CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "indexingStatus" TEXT NOT NULL DEFAULT 'UNPLANNED',
    "ownerProjectId" TEXT,
    CONSTRAINT "Document_ownerProjectId_fkey" FOREIGN KEY ("ownerProjectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("checksum", "createdAt", "displayName", "fileSize", "format", "id", "indexedAt", "indexingStatus", "language", "sourceRef", "sourceType", "storagePath", "updatedAt") SELECT "checksum", "createdAt", "displayName", "fileSize", "format", "id", "indexedAt", "indexingStatus", "language", "sourceRef", "sourceType", "storagePath", "updatedAt" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE UNIQUE INDEX "Document_checksum_key" ON "Document"("checksum");
CREATE INDEX "Document_displayName_idx" ON "Document"("displayName");
CREATE INDEX "Document_ownerProjectId_idx" ON "Document"("ownerProjectId");
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "documentScope" TEXT NOT NULL DEFAULT 'ALL'
);
INSERT INTO "new_Project" ("createdAt", "description", "id", "name", "updatedAt") SELECT "createdAt", "description", "id", "name", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_name_key" ON "Project"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProjectDocument_documentId_idx" ON "ProjectDocument"("documentId");
