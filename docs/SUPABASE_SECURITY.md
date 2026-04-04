# Supabase security hardening

This project reads and writes the database through Prisma on the server, so browser roles (`anon`, `authenticated`) should not have direct access to `public` tables.

To clear Supabase advisor alerts (`rls_disabled_in_public` and `sensitive_columns_exposed`):

1. Open Supabase SQL Editor.
2. Run `docs/supabase-security-hardening.sql`.
3. Re-run Security Advisor and confirm the alerts are gone.

## What the script does

- Enables and forces RLS on every table in `public`.
- Creates a deny-all policy for `anon` and `authenticated` on each table.
- Revokes table/sequence privileges from `anon` and `authenticated`.
- Explicitly revokes access to common sensitive columns (`password`, `email`, `token`, `secret`, keys).

## Important

- If you later add public client-side SQL access, replace deny-all with explicit allow policies for only the needed tables.
- Keep using server-side Prisma/API routes for privileged operations.
