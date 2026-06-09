-- FSC V17 RLS hardening for new operational tables.
-- These tables are server/admin operated through Prisma. Direct Supabase anon/auth access stays blocked by RLS with no public policies.

ALTER TABLE "provider_sync_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "system_settings" ENABLE ROW LEVEL SECURITY;