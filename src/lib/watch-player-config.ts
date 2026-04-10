/**
 * Watch player runtime config schema + normalization.
 *
 * This module is intentionally framework-agnostic so both API routes and
 * client pages can share the same constraints and fallback behavior.
 */
export const WATCH_PLAYER_CONFIG_ANNOUNCEMENT_TITLE = "__system:watch_player_config__";

export const WATCH_PLAYER_SOURCE_KEYS = [
  "direct",
  "google_drive",
  "embed",
  "external",
] as const;

export type WatchPlayerSourceKey = (typeof WATCH_PLAYER_SOURCE_KEYS)[number];

export type WatchPlayerConfig = {
  autoplaySeconds: number;
  nextPromptDefaultWindowSeconds: number;
  nextPromptWindowBySource: Record<WatchPlayerSourceKey, number>;
};

export type WatchPlayerConfigState = WatchPlayerConfig & {
  updatedAt: string | null;
};

export const WATCH_PLAYER_DEFAULT_CONFIG: WatchPlayerConfig = {
  autoplaySeconds: 10,
  nextPromptDefaultWindowSeconds: 25,
  nextPromptWindowBySource: {
    direct: 25,
    google_drive: 20,
    embed: 18,
    external: 18,
  },
};

function normalizeInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

export function normalizeWatchPlayerConfig(input?: Partial<WatchPlayerConfig> | null) {
  const sourceInput = (input?.nextPromptWindowBySource || {}) as Partial<
    Record<WatchPlayerSourceKey, number>
  >;

  const nextPromptWindowBySource = WATCH_PLAYER_SOURCE_KEYS.reduce<
    Record<WatchPlayerSourceKey, number>
  >((acc, sourceKey) => {
    const fallback = WATCH_PLAYER_DEFAULT_CONFIG.nextPromptWindowBySource[sourceKey];
    acc[sourceKey] = normalizeInteger(sourceInput[sourceKey], fallback, 8, 120);
    return acc;
  }, {} as Record<WatchPlayerSourceKey, number>);

  return {
    autoplaySeconds: normalizeInteger(
      input?.autoplaySeconds,
      WATCH_PLAYER_DEFAULT_CONFIG.autoplaySeconds,
      3,
      60,
    ),
    nextPromptDefaultWindowSeconds: normalizeInteger(
      input?.nextPromptDefaultWindowSeconds,
      WATCH_PLAYER_DEFAULT_CONFIG.nextPromptDefaultWindowSeconds,
      8,
      120,
    ),
    nextPromptWindowBySource,
  } satisfies WatchPlayerConfig;
}

export function resolveNextPromptWindowSeconds(
  sourceType?: string,
  configInput?: Partial<WatchPlayerConfig> | null,
) {
  const config = normalizeWatchPlayerConfig(configInput || undefined);
  const normalizedSource = String(sourceType || "").trim().toLowerCase() as WatchPlayerSourceKey;
  const sourceValue = config.nextPromptWindowBySource[normalizedSource];
  const rawValue = Number.isFinite(sourceValue)
    ? sourceValue
    : config.nextPromptDefaultWindowSeconds;

  return Math.max(8, Math.floor(rawValue));
}
