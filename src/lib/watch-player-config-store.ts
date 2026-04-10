import prisma from "@/lib/prisma";

/**
 * Persistence layer for watch player runtime config.
 *
 * The project stores system-level toggles in the Announcement table
 * using reserved `__system:*` titles. This keeps runtime config mutable
 * from admin UI without requiring redeploys.
 */
import {
  WATCH_PLAYER_CONFIG_ANNOUNCEMENT_TITLE,
  WATCH_PLAYER_DEFAULT_CONFIG,
  normalizeWatchPlayerConfig,
  type WatchPlayerConfig,
  type WatchPlayerConfigState,
} from "@/lib/watch-player-config";

type WatchPlayerConfigPayload = Partial<WatchPlayerConfig> & {
  updatedAt?: string;
};

function parsePayload(content?: string | null): WatchPlayerConfigPayload {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export async function getWatchPlayerConfigState(): Promise<WatchPlayerConfigState> {
  const row = await prisma.announcement.findFirst({
    where: { title: WATCH_PLAYER_CONFIG_ANNOUNCEMENT_TITLE },
    orderBy: { createdAt: "desc" },
    select: { id: true, content: true, createdAt: true },
  });

  if (!row) {
    return {
      ...WATCH_PLAYER_DEFAULT_CONFIG,
      updatedAt: null,
    };
  }

  const payload = parsePayload(row.content);
  const normalized = normalizeWatchPlayerConfig(payload);

  return {
    ...normalized,
    updatedAt: payload.updatedAt || row.createdAt.toISOString(),
  };
}

export async function setWatchPlayerConfigState(
  nextState: Partial<WatchPlayerConfig>,
) {
  const currentState = await getWatchPlayerConfigState();
  const merged = normalizeWatchPlayerConfig({
    ...currentState,
    ...nextState,
    nextPromptWindowBySource: {
      ...currentState.nextPromptWindowBySource,
      ...(nextState.nextPromptWindowBySource || {}),
    },
  });

  const content = JSON.stringify({
    ...merged,
    updatedAt: new Date().toISOString(),
  });

  const row = await prisma.announcement.findFirst({
    where: { title: WATCH_PLAYER_CONFIG_ANNOUNCEMENT_TITLE },
    select: { id: true },
  });

  if (!row) {
    await prisma.announcement.create({
      data: {
        title: WATCH_PLAYER_CONFIG_ANNOUNCEMENT_TITLE,
        content,
      },
    });
  } else {
    await prisma.announcement.update({
      where: { id: row.id },
      data: { content },
    });
  }

  return getWatchPlayerConfigState();
}
