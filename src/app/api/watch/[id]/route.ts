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
    const isAdmin = (session?.user as any)?.role === "admin";

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

    if (!isAdmin && animeData.visibility === "admin_only") {
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
    let resolvedVideoUrl = currentEpisode?.videoUrl;
    let resolvedSourceType = detectVideoSource(
      resolvedVideoUrl,
      currentEpisode?.sourceType,
    );
    const sources: { label: string; url: string; type: string }[] = [];
    if (resolvedVideoUrl) {
      sources.push({ label: "Principal", url: resolvedVideoUrl, type: resolvedSourceType });
    }

    // Sugoi fallback: se não houver videoUrl e sourceLabel começar com "sugoi:slug[:season]"
    if (!resolvedVideoUrl && currentEpisode?.sourceLabel?.startsWith("sugoi:")) {
      const parts = currentEpisode.sourceLabel.split(":");
      const slug = parts[1];
      const season = parts[2] || "1";
      if (slug) {
        const baseUrl = (process.env.SUGOI_API_BASE || "https://sugoiapi.vercel.app").replace(/\/$/, "");
        const sugoiUrl = `${baseUrl}/episode/${slug}/${season}/${currentEpisode.number}`;
        try {
          const r = await fetch(sugoiUrl, { headers: { accept: "application/json" } });
          const j = await r.json();
          const providers = Array.isArray(j?.data) ? j.data : [];
          const sources = providers.flatMap((provider: any) => {
            const eps = Array.isArray(provider?.episodes) ? provider.episodes : [];
            return eps
              .filter((ep: any) => ep && ep.episode)
              .map((ep: any) => ({ url: ep.episode as string, isEmbed: !!provider.is_embed }));
          });
          const primary = sources.find((s) => !s.isEmbed) || sources[0];
          if (primary?.url) {
            resolvedVideoUrl = primary.url;
            resolvedSourceType = detectVideoSource(primary.url, primary.isEmbed ? "embed" : "direct");
            sources.push({ label: "Sugoi", url: primary.url, type: resolvedSourceType });
          }
        } catch (err) {
          // fallback silencioso para evitar quebra no watch
        }
      }
    }

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
      videoToPlay: resolvedVideoUrl || "",
      embedUrl: toEmbeddableVideoUrl(
        resolvedVideoUrl,
        resolvedSourceType,
      ),
      sources,
      epTitle: `Episodio ${currentEpisode.number} - ${currentEpisode.title}`,
      playlist,
      nextEpisode,
      prevEpisode,
      history:
        viewerSettings.resumePlayback && resolvedSourceType === "direct"
          ? history
          : null,
      viewerSettings,
      sourceType: resolvedSourceType,
      isDirectSource: resolvedSourceType === "direct",
    });
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
