-- Embed provider metadata, password reset tokens and lightweight performance preferences.

ALTER TABLE "Anime"
  ADD COLUMN IF NOT EXISTS "externalProvider" TEXT,
  ADD COLUMN IF NOT EXISTS "externalId" TEXT,
  ADD COLUMN IF NOT EXISTS "externalIdType" TEXT,
  ADD COLUMN IF NOT EXISTS "mediaType" TEXT NOT NULL DEFAULT 'anime';

ALTER TABLE "Episode"
  ALTER COLUMN "videoUrl" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "externalProvider" TEXT,
  ADD COLUMN IF NOT EXISTS "externalId" TEXT,
  ADD COLUMN IF NOT EXISTS "externalIdType" TEXT,
  ADD COLUMN IF NOT EXISTS "externalSeason" INTEGER,
  ADD COLUMN IF NOT EXISTS "externalEpisode" INTEGER;

ALTER TABLE "UserSettings"
  ADD COLUMN IF NOT EXISTS "dataSaver" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PasswordResetToken_userId_fkey'
  ) THEN
    ALTER TABLE "PasswordResetToken"
      ADD CONSTRAINT "PasswordResetToken_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
