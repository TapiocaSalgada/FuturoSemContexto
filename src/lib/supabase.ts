import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Server-side client (full access for uploads, etc.)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Client-side client (read-only public)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
