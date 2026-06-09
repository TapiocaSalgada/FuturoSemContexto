CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "content" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "kind" TEXT NOT NULL DEFAULT 'anime',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "synopsis" TEXT,
  "posterUrl" TEXT,
  "bannerUrl" TEXT,
  "genres" JSONB,
  "year" INTEGER,
  "ageRating" TEXT,
  "language" TEXT,
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "externalIds" JSONB,
  "createdById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "content_kind_status_updatedAt_idx" ON "content"("kind", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "content_isFeatured_status_idx" ON "content"("isFeatured", "status");

CREATE TABLE IF NOT EXISTS "seasons" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "contentId" TEXT NOT NULL REFERENCES "content"("id") ON DELETE CASCADE,
  "seasonNumber" INTEGER NOT NULL,
  "title" TEXT,
  "synopsis" TEXT,
  "posterUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seasons_contentId_seasonNumber_key" UNIQUE ("contentId", "seasonNumber")
);

CREATE INDEX IF NOT EXISTS "seasons_contentId_status_idx" ON "seasons"("contentId", "status");

CREATE TABLE IF NOT EXISTS "episodes" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "contentId" TEXT NOT NULL REFERENCES "content"("id") ON DELETE CASCADE,
  "seasonId" TEXT REFERENCES "seasons"("id") ON DELETE SET NULL,
  "episodeNumber" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "synopsis" TEXT,
  "thumbnailUrl" TEXT,
  "durationSec" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "airDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "episodes_contentId_seasonId_episodeNumber_key" UNIQUE ("contentId", "seasonId", "episodeNumber")
);

CREATE INDEX IF NOT EXISTS "episodes_contentId_status_idx" ON "episodes"("contentId", "status");
CREATE INDEX IF NOT EXISTS "episodes_seasonId_episodeNumber_idx" ON "episodes"("seasonId", "episodeNumber");

CREATE TABLE IF NOT EXISTS "sources" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "contentId" TEXT REFERENCES "content"("id") ON DELETE CASCADE,
  "episodeId" TEXT NOT NULL REFERENCES "episodes"("id") ON DELETE CASCADE,
  "provider" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "url" TEXT,
  "storagePath" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "sources_episodeId_isActive_priority_idx" ON "sources"("episodeId", "isActive", "priority");
CREATE INDEX IF NOT EXISTS "sources_contentId_isActive_idx" ON "sources"("contentId", "isActive");

CREATE TABLE IF NOT EXISTS "watch_progress" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "contentId" TEXT NOT NULL REFERENCES "content"("id") ON DELETE CASCADE,
  "episodeId" TEXT NOT NULL REFERENCES "episodes"("id") ON DELETE CASCADE,
  "progressSeconds" INTEGER NOT NULL DEFAULT 0,
  "durationSeconds" INTEGER,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "lastWatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "watch_progress_userId_episodeId_key" UNIQUE ("userId", "episodeId")
);

CREATE INDEX IF NOT EXISTS "watch_progress_userId_lastWatchedAt_idx" ON "watch_progress"("userId", "lastWatchedAt");

CREATE TABLE IF NOT EXISTS "watchlist_folders" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "isPrivate" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "watchlist_folders_userId_name_key" UNIQUE ("userId", "name")
);

CREATE INDEX IF NOT EXISTS "watchlist_folders_userId_createdAt_idx" ON "watchlist_folders"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "watchlist" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "contentId" TEXT NOT NULL REFERENCES "content"("id") ON DELETE CASCADE,
  "folderId" TEXT REFERENCES "watchlist_folders"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "watchlist_userId_contentId_key" UNIQUE ("userId", "contentId")
);

CREATE INDEX IF NOT EXISTS "watchlist_userId_createdAt_idx" ON "watchlist"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "watchlist_folderId_idx" ON "watchlist"("folderId");

CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "adminId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "contentId" TEXT REFERENCES "content"("id") ON DELETE SET NULL,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "admin_audit_logs_adminId_createdAt_idx" ON "admin_audit_logs"("adminId", "createdAt");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_entityType_entityId_idx" ON "admin_audit_logs"("entityType", "entityId");

ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "contentId" TEXT REFERENCES "content"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "BugReport_contentId_createdAt_idx" ON "BugReport"("contentId", "createdAt");

ALTER TABLE "content" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "seasons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "episodes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "watch_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "watchlist_folders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "watchlist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_audit_logs" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_public_read" ON "content";
CREATE POLICY "content_public_read" ON "content"
FOR SELECT TO anon, authenticated
USING ("status" = 'public');

DROP POLICY IF EXISTS "seasons_public_read" ON "seasons";
CREATE POLICY "seasons_public_read" ON "seasons"
FOR SELECT TO anon, authenticated
USING ("status" = 'public' AND EXISTS (
  SELECT 1 FROM "content" c WHERE c."id" = "seasons"."contentId" AND c."status" = 'public'
));

DROP POLICY IF EXISTS "episodes_public_read" ON "episodes";
CREATE POLICY "episodes_public_read" ON "episodes"
FOR SELECT TO anon, authenticated
USING ("status" = 'public' AND EXISTS (
  SELECT 1 FROM "content" c WHERE c."id" = "episodes"."contentId" AND c."status" = 'public'
));

DROP POLICY IF EXISTS "watch_progress_self" ON "watch_progress";
CREATE POLICY "watch_progress_self" ON "watch_progress"
FOR ALL TO authenticated
USING (auth.uid()::text = "userId")
WITH CHECK (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "watchlist_folders_self" ON "watchlist_folders";
CREATE POLICY "watchlist_folders_self" ON "watchlist_folders"
FOR ALL TO authenticated
USING (auth.uid()::text = "userId")
WITH CHECK (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "watchlist_self" ON "watchlist";
CREATE POLICY "watchlist_self" ON "watchlist"
FOR ALL TO authenticated
USING (auth.uid()::text = "userId")
WITH CHECK (auth.uid()::text = "userId");
