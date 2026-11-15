-- AlterTable
ALTER TABLE "Document" ADD COLUMN "driveAccountEmail" TEXT;

-- The Drive documents imported before: the account their owner is connected to now. A guess: an owner who
-- changed account since gets their former documents attributed to the new one.
UPDATE "Document"
SET "driveAccountEmail" = (SELECT "email" FROM "GoogleDriveConnection" WHERE "GoogleDriveConnection"."userId" = "Document"."userId")
WHERE "sourceType" = 'GOOGLE_DRIVE';
