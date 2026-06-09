-- FSC V17 additive schema support.
-- Safe additions only: no catalog cleanup and no destructive data changes.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

ALTER TABLE "episodes" ADD COLUMN IF NOT EXISTS "slug" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "episodes_contentId_slug_key" ON "episodes"("contentId", "slug");

ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "quality" TEXT;
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "language" TEXT;
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "lastCheckedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "provider_sync_logs" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'manual',
  "status" TEXT NOT NULL DEFAULT 'preview',
  "contentId" TEXT,
  "summary" JSONB,
  "diff" JSONB,
  "error" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "provider_sync_logs_provider_createdAt_idx" ON "provider_sync_logs"("provider", "createdAt");
CREATE INDEX IF NOT EXISTS "provider_sync_logs_contentId_createdAt_idx" ON "provider_sync_logs"("contentId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'provider_sync_logs_contentId_fkey'
  ) THEN
    ALTER TABLE "provider_sync_logs"
      ADD CONSTRAINT "provider_sync_logs_contentId_fkey"
      FOREIGN KEY ("contentId") REFERENCES "content"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'provider_sync_logs_createdById_fkey'
  ) THEN
    ALTER TABLE "provider_sync_logs"
      ADD CONSTRAINT "provider_sync_logs_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "system_settings" (
  "key" TEXT NOT NULL,
  "value" JSONB,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);
