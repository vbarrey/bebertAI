-- The pipeline of before the users becomes the first admin's (oldest admin account); without any admin it is dropped,
-- each user then starting from the default pipeline.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PipelineParameters" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "parameters" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PipelineParameters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PipelineParameters" ("userId", "createdAt", "parameters", "updatedAt") SELECT (SELECT "id" FROM "User" WHERE "role" = 'admin' ORDER BY "createdAt" LIMIT 1), "createdAt", "parameters", "updatedAt" FROM "PipelineParameters" WHERE (SELECT "id" FROM "User" WHERE "role" = 'admin' ORDER BY "createdAt" LIMIT 1) IS NOT NULL;
DROP TABLE "PipelineParameters";
ALTER TABLE "new_PipelineParameters" RENAME TO "PipelineParameters";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

