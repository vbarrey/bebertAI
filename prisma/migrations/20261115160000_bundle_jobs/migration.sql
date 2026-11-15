-- CreateTable
CREATE TABLE "BundleJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "parameters" JSONB NOT NULL,
    "label" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "filePath" TEXT,
    "fileSize" BIGINT,
    "result" JSONB,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "BundleJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BundleJob_userId_createdAt_idx" ON "BundleJob"("userId", "createdAt");

