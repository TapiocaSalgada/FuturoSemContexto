import prisma from "@/lib/prisma";

export const NAVIGATION_ANNOUNCEMENT_TITLE = "__system:navigation__";

export type NavigationState = {
  animeTabEnabled: boolean;
  mangaTabEnabled: boolean;
  updatedAt: string | null;
};

type NavigationPayload = {
  animeTabEnabled?: boolean;
  mangaTabEnabled?: boolean;
  updatedAt?: string;
};

function parsePayload(content?: string | null): NavigationPayload {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export async function getNavigationState(): Promise<NavigationState> {
  const row = await prisma.announcement.findFirst({
    where: { title: NAVIGATION_ANNOUNCEMENT_TITLE },
    orderBy: { createdAt: "desc" },
    select: { id: true, content: true, createdAt: true },
  });

  if (!row) {
    return {
      animeTabEnabled: true,
      mangaTabEnabled: false,
      updatedAt: null,
    };
  }

  const payload = parsePayload(row.content);
  return {
    animeTabEnabled: payload.animeTabEnabled ?? true,
    // Product is anime-only; manga tab stays permanently disabled.
    mangaTabEnabled: false,
    updatedAt: payload.updatedAt || row.createdAt.toISOString(),
  };
}

export async function setNavigationState(nextState: {
  animeTabEnabled: boolean;
  mangaTabEnabled: boolean;
}) {
  const content = JSON.stringify({
    animeTabEnabled: nextState.animeTabEnabled,
    // Persisted as false to keep all surfaces anime-only.
    mangaTabEnabled: false,
    updatedAt: new Date().toISOString(),
  });

  const row = await prisma.announcement.findFirst({
    where: { title: NAVIGATION_ANNOUNCEMENT_TITLE },
    select: { id: true },
  });

  if (!row) {
    await prisma.announcement.create({
      data: {
        title: NAVIGATION_ANNOUNCEMENT_TITLE,
        content,
      },
    });
  } else {
    await prisma.announcement.update({
      where: { id: row.id },
      data: { content },
    });
  }

  return getNavigationState();
}
