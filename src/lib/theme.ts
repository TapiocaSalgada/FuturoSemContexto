export const APP_THEMES = ["kandaraku-dark", "kandaraku-light"] as const;

export type AppTheme = (typeof APP_THEMES)[number];

export function normalizeTheme(input?: string | null): AppTheme {
  const value = String(input || "").trim().toLowerCase();
  if (
    value === "kandaraku-light" ||
    value === "light" ||
    value === "claro"
  ) {
    return "kandaraku-light";
  }

  return "kandaraku-dark";
}

export function getThemeMetaColor(theme?: string | null): string {
  if (normalizeTheme(theme) === "kandaraku-light") {
    return "#f7f8fa";
  }

  return "#050608";
}
