import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import prisma from "@/lib/prisma";
import { normalizeSettings } from "@/lib/settings";

function toSettingsResponse(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  return normalizeSettings({
    theme: user?.settings?.theme,
    reducedMotion: user?.settings?.reducedMotion,
    neonEffects: user?.settings?.neonEffects,
    showHistory: user?.settings?.showHistory,
    autoplay: user?.settings?.autoplay,
    resumePlayback: user?.settings?.resumePlayback,
    publicProfile: user ? !user.isPrivate : true,
    allowFollow: user?.settings?.allowFollow,
    playbackSpeed: user?.settings?.playbackSpeed,
    notifyAnnouncements: user?.settings?.notifyAnnouncements,
    notifyEpisodes: user?.settings?.notifyEpisodes,
    notifyFollowers: user?.settings?.notifyFollowers,
    notifyReplies: user?.settings?.notifyReplies,
  });
}

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json(toSettingsResponse(user));
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const next = normalizeSettings({
    ...toSettingsResponse(user),
    ...body,
  });

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { isPrivate: !next.publicProfile },
    }),
    prisma.userSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        theme: next.theme,
        reducedMotion: next.reducedMotion,
        neonEffects: next.neonEffects,
        showHistory: next.showHistory,
        autoplay: next.autoplay,
        resumePlayback: next.resumePlayback,
        playbackSpeed: next.playbackSpeed,
        allowFollow: next.allowFollow,
        notifyAnnouncements: next.notifyAnnouncements,
        notifyEpisodes: next.notifyEpisodes,
        notifyFollowers: next.notifyFollowers,
        notifyReplies: next.notifyReplies,
      },
      update: {
        theme: next.theme,
        reducedMotion: next.reducedMotion,
        neonEffects: next.neonEffects,
        showHistory: next.showHistory,
        autoplay: next.autoplay,
        resumePlayback: next.resumePlayback,
        playbackSpeed: next.playbackSpeed,
        allowFollow: next.allowFollow,
        notifyAnnouncements: next.notifyAnnouncements,
        notifyEpisodes: next.notifyEpisodes,
        notifyFollowers: next.notifyFollowers,
        notifyReplies: next.notifyReplies,
        wallpaperUrl: (body as any)?.wallpaperUrl || undefined,
        wallpaperEnabled: (body as any)?.wallpaperEnabled ?? undefined,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, settings: next });
}
