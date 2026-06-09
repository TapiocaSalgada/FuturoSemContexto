type EnvEntry = {
  key: string;
  present: boolean;
};

const REQUIRED_ENV_KEYS = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_KEY",
] as const;

const OPTIONAL_ENV_KEYS = [
  "OWNER_EMAIL",
  "SUGOI_API_BASE",
  "ANFIRE_API_BASE",
  "ANFIRE_API_KEY",
  "ANFIRE_SCRAPER_API_BASE",
  "KAPPA_API_BASE",
  "LEGACY_ANIME_API_BASE",
  "TMDB_API_KEY",
] as const;

function hasEnv(key: string) {
  return Boolean(String(process.env[key] || "").trim());
}

function toEntries(keys: readonly string[]): EnvEntry[] {
  return keys.map((key) => ({ key, present: hasEnv(key) }));
}

export function getEnvChecklist() {
  const required = toEntries(REQUIRED_ENV_KEYS);
  const optional = toEntries(OPTIONAL_ENV_KEYS);

  return {
    required,
    optional,
    missingRequired: required.filter((item) => !item.present).map((item) => item.key),
    missingOptional: optional.filter((item) => !item.present).map((item) => item.key),
  };
}
