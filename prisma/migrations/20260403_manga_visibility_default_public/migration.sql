-- Keep existing visibility values as-is, only change default for new rows.
ALTER TABLE "Manga"
ALTER COLUMN "visibility" SET DEFAULT 'public';

UPDATE "Manga"
SET "visibility" = 'public'
WHERE "visibility" IS NULL;
