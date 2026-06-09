import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const confirmation = process.env.FSC_CONFIRM_CATALOG_CLEANUP;
const target = (process.env.FSC_CLEANUP_TARGET || "").toLowerCase();
const allowProduction = process.env.FSC_ALLOW_PRODUCTION_CLEANUP === "true";
const databaseUrl = process.env.DATABASE_URL || "";

if (confirmation !== "LIMPAR_CATALOGO_FSC") {
  throw new Error("Set FSC_CONFIRM_CATALOG_CLEANUP=LIMPAR_CATALOGO_FSC to run this destructive staging cleanup.");
}

if (!target || !["preview", "staging", "local"].includes(target)) {
  throw new Error("Set FSC_CLEANUP_TARGET to preview, staging, or local. Production is refused by default.");
}

if (!allowProduction && /prod|production/i.test(databaseUrl)) {
  throw new Error("Refusing cleanup on a DATABASE_URL that looks like production.");
}

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const deleted = {};

    deleted.watchProgress = (await tx.watchProgress.deleteMany()).count;
    deleted.watchlist = (await tx.watchlist.deleteMany()).count;
    deleted.watchlistFolders = (await tx.watchlistFolder.deleteMany()).count;
    deleted.adminAuditLogsForContent = (await tx.adminAuditLog.deleteMany({ where: { contentId: { not: null } } })).count;
    deleted.providerSyncLogs = (await tx.providerSyncLog.deleteMany()).count;
    deleted.sources = (await tx.source.deleteMany()).count;
    deleted.catalogEpisodes = (await tx.catalogEpisode.deleteMany()).count;
    deleted.seasons = (await tx.season.deleteMany()).count;
    deleted.content = (await tx.content.deleteMany()).count;

    deleted.legacyHistory = (await tx.watchHistory.deleteMany()).count;
    deleted.legacyFavorites = (await tx.favorite.deleteMany()).count;
    deleted.legacyFavoriteFolders = (await tx.favoriteFolder.deleteMany()).count;
    deleted.legacyComments = (await tx.comment.deleteMany()).count;
    deleted.legacyRatings = (await tx.animeRating.deleteMany()).count;
    deleted.legacyEpisodeSources = (await tx.episodeSource.deleteMany()).count;
    deleted.legacyEpisodes = (await tx.episode.deleteMany()).count;
    deleted.legacySeasons = (await tx.animeSeason.deleteMany()).count;
    deleted.legacyAnime = (await tx.anime.deleteMany()).count;
    deleted.mangaChapters = (await tx.mangaChapter.deleteMany()).count;
    deleted.mangas = (await tx.manga.deleteMany()).count;

    return deleted;
  });

  console.log(JSON.stringify({ ok: true, target, deleted: result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
