import { normalizeTheme } from "@/lib/theme";

export const DEFAULT_SETTINGS = {
  theme: "futuro-noir",
  reducedMotion: false,
  neonEffects: false,
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
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(partial || {}),
  };

  return {
    ...merged,
    theme: normalizeTheme(merged.theme),
    notifyAnnouncements: true, // Always true (mandatory)
    notifyEpisodes: false, // Disabled feature
  };
}
