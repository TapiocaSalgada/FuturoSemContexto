export const DEFAULT_SETTINGS = {
  theme: "pink",
  reducedMotion: false,
  neonEffects: true,
  showHistory: true,
  autoplay: true,
  resumePlayback: true,
  publicProfile: true,
  allowFollow: true,
  playbackSpeed: "Normal" as string,
  notifyAnnouncements: true,
  notifyEpisodes: true,
  notifyFollowers: true,
  notifyReplies: true,
};

export interface UserSettingsPayload {
  theme: string;
  reducedMotion: boolean;
  neonEffects: boolean;
  showHistory: boolean;
  autoplay: boolean;
  resumePlayback: boolean;
  publicProfile: boolean;
  allowFollow: boolean;
  playbackSpeed: string;
  notifyAnnouncements: boolean;
  notifyEpisodes: boolean;
  notifyFollowers: boolean;
  notifyReplies: boolean;
}

export function normalizeSettings(
  partial?: Partial<UserSettingsPayload> | null,
): UserSettingsPayload {
  return {
    ...DEFAULT_SETTINGS,
    ...(partial || {}),
    notifyAnnouncements: true, // Always true (mandatory)
    notifyEpisodes: false, // Disabled feature
  };
}
