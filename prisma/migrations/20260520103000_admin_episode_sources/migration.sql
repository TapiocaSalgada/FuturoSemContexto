-- Add real multi-source support for legacy Episode playback.
CREATE TABLE IF NOT EXISTS "EpisodeSource" (
  "id" TEXT NOT NULL,
  "episodeId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'manual',
  "sourceType" TEXT NOT NULL DEFAULT 'external',
  "url" TEXT,
  "storagePath" TEXT,
  "quality" TEXT,
  "language" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastCheckedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EpisodeSource_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EpisodeSource_episodeId_fkey'
  ) THEN
    ALTER TABLE "EpisodeSource"
      ADD CONSTRAINT "EpisodeSource_episodeId_fkey"
      FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "EpisodeSource_episodeId_isActive_priority_idx"
  ON "EpisodeSource"("episodeId", "isActive", "priority");

ALTER TABLE "EpisodeSource" ENABLE ROW LEVEL SECURITY;

-- Optional legacy admin metadata used by the professional admin console.
ALTER TABLE "Anime" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "Anime" ADD COLUMN IF NOT EXISTS "genres" JSONB;
ALTER TABLE "Anime" ADD COLUMN IF NOT EXISTS "year" INTEGER;
ALTER TABLE "Anime" ADD COLUMN IF NOT EXISTS "ageRating" TEXT;
ALTER TABLE "Anime" ADD COLUMN IF NOT EXISTS "language" TEXT;
ALTER TABLE "Anime" ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Anime" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Anime" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Anime_slug_key'
  ) THEN
    CREATE UNIQUE INDEX "Anime_slug_key" ON "Anime"("slug");
  END IF;
END $$;

ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'site_bug';
ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "deviceInfo" JSONB;
ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "adminNotes" TEXT;

ALTER TABLE "Suggestion" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'content_request';
ALTER TABLE "Suggestion" ADD COLUMN IF NOT EXISTS "adminNotes" TEXT;
