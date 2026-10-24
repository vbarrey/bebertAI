-- The Google account connected before the users becomes the first admin's (oldest admin account); without any admin
-- it is dropped and each user connects their own.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GoogleDriveConnection" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GoogleDriveConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GoogleDriveConnection" ("userId", "accessToken", "createdAt", "email", "expiresAt", "refreshToken", "updatedAt") SELECT (SELECT "id" FROM "User" WHERE "role" = 'admin' ORDER BY "createdAt" LIMIT 1), "accessToken", "createdAt", "email", "expiresAt", "refreshToken", "updatedAt" FROM "GoogleDriveConnection" WHERE (SELECT "id" FROM "User" WHERE "role" = 'admin' ORDER BY "createdAt" LIMIT 1) IS NOT NULL;
DROP TABLE "GoogleDriveConnection";
ALTER TABLE "new_GoogleDriveConnection" RENAME TO "GoogleDriveConnection";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

