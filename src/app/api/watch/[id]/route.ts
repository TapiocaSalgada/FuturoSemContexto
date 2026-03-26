import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizeSettings } from "@/lib/settings";
import { detectVideoSource, toEmbeddableVideoUrl } from "@/lib/video";

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    const anime = await prisma.anime.findUnique({
      where: { id: params.id },
      include: {
        episodes: {
          orderBy: [{ season: "asc" }, { number: "asc" }],
        },
      },
    });

    let episodeToPlay = null as
      | (Awaited<ReturnType<typeof prisma.episode.findUnique>> & {
          anime?: Awaited<ReturnType<typeof prisma.anime.findUnique>>;
        })
      | null;
    let animeData = anime;

    if (anime) {
      episodeToPlay = anime.episodes[0] || null;
    } else {
      const episode = await prisma.episode.findUnique({
        where: { id: params.id },
        include: {
          anime: {
            include: {
              episodes: {
                orderBy: [{ season: "asc" }, { number: "asc" }],
              },
            },
          },
        },
      });
      if (episode) {
        episodeToPlay = episode;
        animeData = episode.anime as any;
      }
    }

    if (!animeData || !episodeToPlay) {
      return new NextResponse("Not found", { status: 404 });
    }

    const playlist = (animeData.episodes || []).slice().sort((a, b) => {
      if (a.season !== b.season) return a.season - b.season;
      return a.number - b.number;
    });
    const currentIndex = playlist.findIndex(
      (episode) => episode.id === episodeToPlay?.id,
    );
    const currentEpisode =
      currentIndex >= 0 ? playlist[currentIndex] : episodeToPlay;
    const nextEpisode =
      currentIndex >= 0 ? playlist[currentIndex + 1] || null : null;
    const prevEpisode =
      currentIndex > 0 ? playlist[currentIndex - 1] || null : null;
    const sourceType = detectVideoSource(
      currentEpisode?.videoUrl,
      currentEpisode?.sourceType,
    );

    let history = null;
    let viewerSettings = normalizeSettings();
    if (userEmail) {
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
        include: { settings: true },
      });
      if (user) {
        history = await prisma.watchHistory.findUnique({
          where: {
            userId_episodeId: {
              userId: user.id,
              episodeId: currentEpisode.id,
            },
          },
        });
        viewerSettings = normalizeSettings({
          theme: user.settings?.theme,
          reducedMotion: user.settings?.reducedMotion,
          neonEffects: user.settings?.neonEffects,
          showHistory: user.settings?.showHistory,
          autoplay: user.settings?.autoplay,
          resumePlayback: user.settings?.resumePlayback,
          publicProfile: !user.isPrivate,
          allowFollow: user.settings?.allowFollow,
          playbackSpeed: user.settings?.playbackSpeed,
          notifyAnnouncements: user.settings?.notifyAnnouncements,
          notifyEpisodes: user.settings?.notifyEpisodes,
          notifyFollowers: user.settings?.notifyFollowers,
          notifyReplies: user.settings?.notifyReplies,
        });
      }
    }

    return NextResponse.json({
      anime: animeData,
      episode: currentEpisode,
      episodeId: currentEpisode.id,
      videoToPlay: currentEpisode.videoUrl || "",
      embedUrl: toEmbeddableVideoUrl(
        currentEpisode.videoUrl,
        currentEpisode.sourceType,
      ),
      epTitle: `Episodio ${currentEpisode.number} - ${currentEpisode.title}`,
      playlist,
      nextEpisode,
      prevEpisode,
      history:
        viewerSettings.resumePlayback && sourceType === "direct"
          ? history
          : null,
      viewerSettings,
      sourceType,
      isDirectSource: sourceType === "direct",
    });
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
