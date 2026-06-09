import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Public anon client. Authorization must be enforced by RLS/server routes.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
