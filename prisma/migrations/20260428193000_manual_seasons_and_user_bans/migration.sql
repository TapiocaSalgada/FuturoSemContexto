-- Manual catalog seasons and user moderation bans.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "banned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "banReason" TEXT,
ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "bannedUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "bannedById" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_bannedById_fkey'
  ) THEN
    ALTER TABLE "User"
    ADD CONSTRAINT "User_bannedById_fkey"
    FOREIGN KEY ("bannedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "AnimeSeason" (
  "id" TEXT NOT NULL,
  "animeId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "name" TEXT,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'published',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnimeSeason_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AnimeSeason_animeId_fkey'
  ) THEN
    ALTER TABLE "AnimeSeason"
    ADD CONSTRAINT "AnimeSeason_animeId_fkey"
    FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "AnimeSeason_animeId_number_key" ON "AnimeSeason"("animeId", "number");
CREATE INDEX IF NOT EXISTS "AnimeSeason_animeId_status_idx" ON "AnimeSeason"("animeId", "status");
ALTER TABLE "Episode"
ADD COLUMN IF NOT EXISTS "description" TEXT,
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'published';
