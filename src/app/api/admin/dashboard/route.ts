import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    // @ts-expect-error role
    if (!session || session.user?.role !== "admin") {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const [totalUsers, totalAnimes, totalEpisodes, totalViews, recentUsers] = await Promise.all([
      prisma.user.count(),
      prisma.anime.count(),
      prisma.episode.count(),
      prisma.watchHistory.count(),
      prisma.user.findMany({
        orderBy: { id: "desc" },
        take: 5,
        select: { id: true, name: true, avatarUrl: true, role: true }
      })
    ]);

    return NextResponse.json({
      totalUsers,
      totalAnimes,
      totalEpisodes,
      totalViews,
      recentUsers
    });
  } catch (error) {
    console.error("Dashboard Stats Error", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
