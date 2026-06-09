export const APP_THEMES = [
  "futuro-classic",
  "dark-minimal",
  "neon-purple",
  "red-cinema",
  "blue-night",
] as const;

export type AppTheme = (typeof APP_THEMES)[number];

export const APP_THEME_LABELS: Record<AppTheme, string> = {
  "futuro-classic": "Futuro Classic",
  "dark-minimal": "Dark Minimal",
  "neon-purple": "Neon Purple",
  "red-cinema": "Red Cinema",
  "blue-night": "Blue Night",
};

export function normalizeTheme(input?: string | null): AppTheme {
  const value = String(input || "").trim().toLowerCase();
  if (APP_THEMES.includes(value as AppTheme)) return value as AppTheme;
  if (
    !value ||
    value === "futuro-noir" ||
    value === "pink" ||
    value === "kandaraku-dark" ||
    value === "kandaraku-light" ||
    value === "claro"
  ) {
    return "futuro-classic";
  }
  if (value === "dark" || value === "light") return "dark-minimal";
  return "futuro-classic";
}

export function getThemeMetaColor(theme?: string | null): string {
  const normalized = normalizeTheme(theme);
  if (normalized === "blue-night") return "#020712";
  if (normalized === "red-cinema") return "#080202";
  return "#050608";
}
