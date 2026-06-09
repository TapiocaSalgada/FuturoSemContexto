import "server-only";

import { createClient } from "@supabase/supabase-js";

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required on the server`);
  }
  return value;
}

export function getSupabaseAdmin() {
  return createClient(
    readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    readRequiredEnv("SUPABASE_SERVICE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
