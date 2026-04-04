// lib/checkAchievements.ts
// Call this server-side after significant user actions.
// It is idempotent — safe to call multiple times.

import prisma from "@/lib/prisma";

async function award(userId: string, achievementId: string) {
  await prisma.userAchievement.upsert({
    where: { userId_achievementId: { userId, achievementId } },
    create: { userId, achievementId },
    update: {},
  });
}

export async function checkAchievements(userId: string) {
  const [user, histories, favorites, folders, comments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        avatarUrl: true,
        bio: true,
        settings: true,
      },
    }),
    prisma.watchHistory.findMany({
      where: { userId },
      include: {
        episode: {
          include: {
            anime: {
              include: {
                categories: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.favorite.findMany({
      where: { userId },
      include: {
        anime: {
          include: {
            categories: {
              select: { id: true },
            },
          },
        },
      },
    }),
    prisma.favoriteFolder.findMany({ where: { userId } }),
    prisma.comment.findMany({ where: { userId } }),
  ]);

  // first_login — always awarded on first check
  await award(userId, "first_login");

  // first_episode
  const watchedEps = histories.filter((h) => h.watched);
  if (watchedEps.length >= 1) await award(userId, "first_episode");

  // episodes milestones
  if (watchedEps.length >= 10) await award(userId, "episodes_10");
  if (watchedEps.length >= 50) await award(userId, "episodes_50");
  if (watchedEps.length >= 100) await award(userId, "episodes_100");

  // first_favorite
  if (favorites.length >= 1) await award(userId, "first_favorite");
  if (favorites.length >= 10) await award(userId, "favorites_10");

  // first_list
  if (folders.length >= 1) await award(userId, "first_list");
  if (folders.length >= 5) await award(userId, "master_lists");
  if (folders.length >= 2) await award(userId, "library_organized");

  // first_comment
  if (comments.length >= 1) await award(userId, "first_comment");

  // profile_complete
  if (user?.name && user?.avatarUrl && user?.bio) await award(userId, "profile_complete");

  // series_finished — check if all eps of any anime are watched
  const animeGroups: Record<string, { total: number; watched: number }> = {};
  for (const h of histories) {
    const animeId = h.episode?.animeId;
    if (!animeId) continue;
    if (!animeGroups[animeId]) animeGroups[animeId] = { total: 0, watched: 0 };
    animeGroups[animeId].total += 1;
    if (h.watched) animeGroups[animeId].watched += 1;
  }

  // Get real total episode counts from DB for each anime seen
  const animeIds = Object.keys(animeGroups);
  if (animeIds.length > 0) {
    const counts = await prisma.episode.groupBy({
      by: ["animeId"],
      where: { animeId: { in: animeIds } },
      _count: { id: true },
    });
    for (const row of counts) {
      const g = animeGroups[row.animeId];
      if (g && g.watched >= row._count.id) {
        await award(userId, "series_finished");
        break;
      }
    }
  }

  // season_finished — all eps of a season watched
  type SeasonKey = string;
  const seasonGroups: Record<SeasonKey, { total: number; watched: number }> = {};
  for (const h of histories) {
    const key = `${h.episode?.animeId}-${h.episode?.season}`;
    if (!seasonGroups[key]) seasonGroups[key] = { total: 0, watched: 0 };
    seasonGroups[key].total += 1;
    if (h.watched) seasonGroups[key].watched += 1;
  }
  for (const g of Object.values(seasonGroups)) {
    if (g.total > 0 && g.watched >= g.total) {
      await award(userId, "season_finished");
      break;
    }
  }

  // anime_explorer — visited 5 different animes (any watch history)
  const uniqueAnimes = new Set(histories.map((h) => h.episode?.animeId).filter(Boolean));
  if (uniqueAnimes.size >= 5) await award(userId, "anime_explorer");

  // elite_marathon — 10 episodes watched in one day
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const watchedToday = watchedEps.filter((h) => new Date(h.updatedAt) >= startOfDay);
  if (watchedToday.length >= 10) await award(userId, "elite_marathon");

  // genre_explorer — watched 5+ categories
  const watchedCategoryIds = new Set<string>();
  for (const h of watchedEps) {
    const categories = h.episode?.anime?.categories || [];
    for (const category of categories) {
      watchedCategoryIds.add(category.id);
    }
  }
  if (watchedCategoryIds.size >= 5) await award(userId, "genre_explorer");

  // genre_focused — 10 favoritos no mesmo genero
  const favoritesByCategory = new Map<string, number>();
  for (const fav of favorites) {
    for (const category of fav.anime.categories) {
      favoritesByCategory.set(category.id, (favoritesByCategory.get(category.id) || 0) + 1);
    }
  }
  if (Array.from(favoritesByCategory.values()).some((count) => count >= 10)) {
    await award(userId, "genre_focused");
  }
}
