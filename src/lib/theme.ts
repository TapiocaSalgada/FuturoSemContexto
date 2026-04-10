export const APP_THEMES = ["futuro-noir"] as const;

export type AppTheme = (typeof APP_THEMES)[number];

const LEGACY_THEME_ALIASES = new Set([
  "kandaraku-dark",
  "kandaraku-light",
  "dark",
  "light",
  "claro",
  "futuro-noir",
]);

export function normalizeTheme(input?: string | null): AppTheme {
  const value = String(input || "").trim().toLowerCase();
  if (!value || LEGACY_THEME_ALIASES.has(value)) return "futuro-noir";
  return "futuro-noir";
}

export function getThemeMetaColor(theme?: string | null): string {
  const normalized = normalizeTheme(theme);
  if (normalized === "futuro-noir") return "#050608";
  return "#050608";
}
