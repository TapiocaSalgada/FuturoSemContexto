export const DEFAULT_SETTINGS = {
  theme: "pink",
  reducedMotion: false,
  neonEffects: true,
  showHistory: true,
  autoplay: true,
  resumePlayback: true,
  publicProfile: true,
  allowFollow: true,
  playbackSpeed: "Normal",
  notifyAnnouncements: true,
  notifyEpisodes: true,
  notifyFollowers: true,
  notifyReplies: true,
} as const;

export type UserSettingsPayload = typeof DEFAULT_SETTINGS;

export function normalizeSettings(
  partial?: Partial<UserSettingsPayload> | null,
): UserSettingsPayload {
  return {
    ...DEFAULT_SETTINGS,
    ...(partial || {}),
  };
}
