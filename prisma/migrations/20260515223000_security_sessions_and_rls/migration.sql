-- Account security tables and defensive RLS for direct Supabase API access.
-- The application uses Prisma/server routes as the authorized data layer; direct anon/authenticated
-- Supabase table access should not expose user-private data.

CREATE TABLE IF NOT EXISTS "AccountSession" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "sessionIdHash" TEXT NOT NULL UNIQUE,
  "userAgent" TEXT,
  "deviceLabel" TEXT,
  "ipMasked" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "AccountSession_userId_lastSeenAt_idx" ON "AccountSession"("userId", "lastSeenAt");
CREATE INDEX IF NOT EXISTS "AccountSession_userId_revokedAt_idx" ON "AccountSession"("userId", "revokedAt");

CREATE TABLE IF NOT EXISTS "SecurityEvent" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "type" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SecurityEvent_userId_createdAt_idx" ON "SecurityEvent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "SecurityEvent_type_createdAt_idx" ON "SecurityEvent"("type", "createdAt");

CREATE TABLE IF NOT EXISTS "UserSecuritySettings" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  "twoFactorSecretEncrypted" TEXT,
  "twoFactorPendingSecretEncrypted" TEXT,
  "twoFactorConfirmedAt" TIMESTAMP(3),
  "sessionInvalidatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE IF EXISTS "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "WatchHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Favorite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "FavoriteFolder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Follows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "AnimeRating" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "BugReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Comment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Suggestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "UserSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "PasswordResetToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "MobilePushToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "UserAchievement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "AccountSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "SecurityEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "UserSecuritySettings" ENABLE ROW LEVEL SECURITY;
