import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    
    // Check if ID is Anime or Episode
    const anime = await prisma.anime.findUnique({
      where: { id: params.id },
      include: { episodes: true }
    });

    let episodeToPlay = null;
    let animeData = anime;

    if (anime) {
      if (anime.episodes.length > 0) {
        episodeToPlay = anime.episodes[0];
      }
    } else {
      // It might be an episode ID directly
      const episode = await prisma.episode.findUnique({
        where: { id: params.id },
        include: { anime: true }
      });
      if (episode) {
        episodeToPlay = episode;
        animeData = episode.anime as any;
      }
    }

    if (!animeData) {
      return new NextResponse("Not found", { status: 404 });
    }

    let history = null;
    if (userEmail && episodeToPlay) {
      const user = await prisma.user.findUnique({ where: { email: userEmail } });
      if (user) {
        history = await prisma.watchHistory.findUnique({
          where: {
            userId_episodeId: {
              userId: user.id,
              episodeId: episodeToPlay.id
            }
          }
        });
      }
    }

    return NextResponse.json({
      anime: animeData,
      episodeId: episodeToPlay?.id,
      videoToPlay: episodeToPlay?.videoUrl || "/videos/(AnimesTotais) JoJo's Bizarre Adventure (Parte 5) Golden Wind - 32 [rlee_BD-RIP_1080p_Trial-Áudio].mkv",
      epTitle: episodeToPlay ? `Episódio ${episodeToPlay.number} - ${episodeToPlay.title}` : "",
      history
    });
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
