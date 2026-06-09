"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/prisma";
import { detectVideoSource } from "@/lib/video";
import { isOwnerEmail } from "@/lib/admin-access";
import { canManageRoles, canUseDestructiveAdminAction, requireAdminActor } from "@/lib/admin/permissions";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { setMaintenanceState } from "@/lib/maintenance";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function nullableText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value || null;
}

function intValue(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ?Math.trunc(parsed) : null;
}

function boolValue(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90);
}

function parseGenres(value: string) {
  const list = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
  return list.length ?list : undefined;
}

function normalizeAnimeStatus(value: string) {
  if (["ongoing", "completed", "draft", "private", "archived", "published"].includes(value)) return value;
  return "ongoing";
}

function normalizeVisibility(value: string) {
  return value === "admin_only" || value === "private" ?"admin_only" : "public";
}

function normalizeContentStatus(value: string) {
  if (["draft", "private", "public", "published", "archived"].includes(value)) return value === "published" ? "public" : value;
  return "draft";
}

function normalizeSourceType(value: string) {
  const next = value.toLowerCase();
  if (["hls", "dash", "mp4", "embed", "external"].includes(next)) return next;
  return detectVideoSource(value, undefined) === "direct" ? "mp4" : "external";
}

export async function createAnimeAction(formData: FormData) {
  const actor = await requireAdminActor();
  const title = text(formData, "title");
  if (!title) throw new Error("Titulo obrigatorio.");

  const desiredSlug = text(formData, "slug") || slugify(title);
  const anime = await prisma.anime.create({
    data: {
      title,
      slug: desiredSlug || null,
      description: nullableText(formData, "description"),
      coverImage: nullableText(formData, "coverImage"),
      bannerImage: nullableText(formData, "bannerImage"),
      mediaType: text(formData, "mediaType") || "anime",
      status: normalizeAnimeStatus(text(formData, "status") || "ongoing"),
      visibility: normalizeVisibility(text(formData, "visibility")),
      genres: parseGenres(text(formData, "genres")) as any,
      year: intValue(formData, "year"),
      ageRating: nullableText(formData, "ageRating"),
      language: nullableText(formData, "language"),
      isFeatured: boolValue(formData, "isFeatured"),
      externalProvider: text(formData, "externalProvider") || "manual",
      externalId: nullableText(formData, "externalId"),
      externalIdType: nullableText(formData, "externalIdType"),
    },
  });

  await writeAdminAuditLog({ actor, action: "content.create", entityType: "Anime", entityId: anime.id, after: { title } });
  revalidatePath("/admin");
  revalidatePath("/admin/catalogo");
  revalidatePath("/");
}

export async function updateAnimeStatusAction(formData: FormData) {
  const actor = await requireAdminActor();
  const id = text(formData, "id");
  const action = text(formData, "action");
  if (!id) throw new Error("ID obrigatorio.");

  const before = await prisma.anime.findUnique({ where: { id }, select: { id: true, title: true, visibility: true, status: true } });
  const data =
    action === "hide"
      ?{ visibility: "admin_only" }
      : action === "publish"
        ?{ visibility: "public", status: "ongoing" }
        : action === "archive"
          ?{ visibility: "admin_only", status: "archived" }
          : { status: normalizeAnimeStatus(text(formData, "status") || before?.status || "ongoing") };

  const after = await prisma.anime.update({ where: { id }, data });
  await writeAdminAuditLog({ actor, action: `content.${action || "status"}`, entityType: "Anime", entityId: id, before, after: { status: after.status, visibility: after.visibility } });
  revalidatePath("/admin/catalogo");
  revalidatePath("/");
}

export async function deleteAnimeAction(formData: FormData) {
  const actor = await requireAdminActor();
  if (!canUseDestructiveAdminAction(actor)) throw new Error("Sem permissao para excluir.");
  const id = text(formData, "id");
  if (!id || text(formData, "confirm") !== "EXCLUIR") throw new Error("Confirmacao invalida.");

  const before = await prisma.anime.findUnique({ where: { id }, select: { id: true, title: true } });
  await prisma.anime.delete({ where: { id } });
  await writeAdminAuditLog({ actor, action: "content.delete", entityType: "Anime", entityId: id, before });
  revalidatePath("/admin/catalogo");
  revalidatePath("/");
}

export async function createSeasonAction(formData: FormData) {
  const actor = await requireAdminActor();
  const animeId = text(formData, "animeId");
  const number = intValue(formData, "number");
  if (!animeId || !number || number <= 0) throw new Error("Conteudo e numero sao obrigatorios.");

  const season = await prisma.animeSeason.upsert({
    where: { animeId_number: { animeId, number } },
    create: {
      animeId,
      number,
      name: nullableText(formData, "name"),
      description: nullableText(formData, "description"),
      status: text(formData, "status") === "draft" ?"draft" : "published",
    },
    update: {
      name: nullableText(formData, "name"),
      description: nullableText(formData, "description"),
      status: text(formData, "status") === "draft" ?"draft" : "published",
    },
  });

  await writeAdminAuditLog({ actor, action: "season.upsert", entityType: "AnimeSeason", entityId: season.id, after: { animeId, number } });
  revalidatePath("/admin/temporadas");
  revalidatePath("/admin/episodios");
}

export async function deleteSeasonAction(formData: FormData) {
  const actor = await requireAdminActor();
  const animeId = text(formData, "animeId");
  const number = intValue(formData, "number");
  const force = text(formData, "confirm") === "EXCLUIR";
  if (!animeId || !number || !force) throw new Error("Confirmacao invalida.");

  await prisma.$transaction([
    prisma.episode.deleteMany({ where: { animeId, season: number } }),
    prisma.animeSeason.deleteMany({ where: { animeId, number } }),
  ]);
  await writeAdminAuditLog({ actor, action: "season.delete", entityType: "AnimeSeason", entityId: `${animeId}:${number}`, before: { animeId, number } });
  revalidatePath("/admin/temporadas");
  revalidatePath("/admin/episodios");
}

export async function createEpisodeAction(formData: FormData) {
  const actor = await requireAdminActor();
  const animeId = text(formData, "animeId");
  const season = intValue(formData, "season") || 1;
  const number = intValue(formData, "number");
  if (!animeId || !number || number <= 0) throw new Error("Anime, temporada e numero sao obrigatorios.");

  const url = text(formData, "videoUrl");
  const sourceType = text(formData, "sourceType") || detectVideoSource(url || "", undefined);
  const episode = await prisma.episode.create({
    data: {
      animeId,
      season,
      number,
      title: text(formData, "title") || `Episodio ${number}`,
      description: nullableText(formData, "description"),
      thumbnailUrl: nullableText(formData, "thumbnailUrl"),
      duration: nullableText(formData, "duration"),
      status: text(formData, "status") === "draft" ?"draft" : "published",
      videoUrl: url || null,
      sourceType,
      sourceLabel: nullableText(formData, "sourceLabel"),
    },
  });

  if (url) {
    await prisma.episodeSource.create({
      data: {
        episodeId: episode.id,
        provider: text(formData, "provider") || "manual",
        sourceType,
        url,
        quality: nullableText(formData, "quality"),
        language: nullableText(formData, "language"),
        priority: intValue(formData, "priority") || 100,
      },
    });
  }

  await writeAdminAuditLog({ actor, action: "episode.create", entityType: "Episode", entityId: episode.id, after: { animeId, season, number } });
  revalidatePath("/admin/episodios");
}

export async function updateEpisodeStatusAction(formData: FormData) {
  const actor = await requireAdminActor();
  const id = text(formData, "id");
  const status = text(formData, "status") === "draft" ?"draft" : "published";
  if (!id) throw new Error("ID obrigatorio.");
  const after = await prisma.episode.update({ where: { id }, data: { status } });
  await writeAdminAuditLog({ actor, action: "episode.status", entityType: "Episode", entityId: id, after: { status: after.status } });
  revalidatePath("/admin/episodios");
}

export async function deleteEpisodeAction(formData: FormData) {
  const actor = await requireAdminActor();
  const id = text(formData, "id");
  if (!id || text(formData, "confirm") !== "EXCLUIR") throw new Error("Confirmacao invalida.");
  const before = await prisma.episode.findUnique({ where: { id }, select: { id: true, title: true, animeId: true } });
  await prisma.episode.delete({ where: { id } });
  await writeAdminAuditLog({ actor, action: "episode.delete", entityType: "Episode", entityId: id, before });
  revalidatePath("/admin/episodios");
}

export async function createEpisodeSourceAction(formData: FormData) {
  const actor = await requireAdminActor();
  const episodeId = text(formData, "episodeId");
  const url = text(formData, "url");
  const storagePath = text(formData, "storagePath");
  if (!episodeId || (!url && !storagePath)) throw new Error("Episodio e URL/storage path sao obrigatorios.");

  const sourceType = text(formData, "sourceType") || detectVideoSource(url, undefined);
  const source = await prisma.episodeSource.create({
    data: {
      episodeId,
      provider: text(formData, "provider") || "manual",
      sourceType,
      url: url || null,
      storagePath: storagePath || null,
      quality: nullableText(formData, "quality"),
      language: nullableText(formData, "language"),
      priority: intValue(formData, "priority") || 100,
      isActive: boolValue(formData, "isActive"),
    },
  });
  await writeAdminAuditLog({ actor, action: "source.create", entityType: "EpisodeSource", entityId: source.id, after: { episodeId, sourceType } });
  revalidatePath("/admin/episodios");
}

export async function toggleEpisodeSourceAction(formData: FormData) {
  const actor = await requireAdminActor();
  const id = text(formData, "id");
  if (!id) throw new Error("ID obrigatorio.");
  const current = await prisma.episodeSource.findUnique({ where: { id }, select: { isActive: true } });
  const after = await prisma.episodeSource.update({ where: { id }, data: { isActive: !current?.isActive } });
  await writeAdminAuditLog({ actor, action: "source.toggle", entityType: "EpisodeSource", entityId: id, after: { isActive: after.isActive } });
  revalidatePath("/admin/episodios");
}

export async function deleteEpisodeSourceAction(formData: FormData) {
  const actor = await requireAdminActor();
  const id = text(formData, "id");
  if (!id || text(formData, "confirm") !== "EXCLUIR") throw new Error("Confirmacao invalida.");
  await prisma.episodeSource.delete({ where: { id } });
  await writeAdminAuditLog({ actor, action: "source.delete", entityType: "EpisodeSource", entityId: id });
  revalidatePath("/admin/episodios");
}

export async function updateBugAction(formData: FormData) {
  const actor = await requireAdminActor();
  const id = text(formData, "id");
  if (!id) throw new Error("ID obrigatorio.");
  const after = await prisma.bugReport.update({
    where: { id },
    data: {
      status: text(formData, "status") || "open",
      priority: text(formData, "priority") || "normal",
      adminNotes: nullableText(formData, "adminNotes"),
    },
  });
  await writeAdminAuditLog({ actor, action: "bug.update", entityType: "BugReport", entityId: id, after: { status: after.status, priority: after.priority } });
  revalidatePath("/admin/bugs");
}

export async function updateSuggestionAction(formData: FormData) {
  const actor = await requireAdminActor();
  const id = text(formData, "id");
  if (!id) throw new Error("ID obrigatorio.");
  const after = await prisma.suggestion.update({
    where: { id },
    data: {
      status: text(formData, "status") || "reviewed",
      adminNotes: nullableText(formData, "adminNotes"),
    },
  });
  await writeAdminAuditLog({ actor, action: "suggestion.update", entityType: "Suggestion", entityId: id, after: { status: after.status } });
  revalidatePath("/admin/sugestoes");
}

export async function updateUserRoleAction(formData: FormData) {
  const actor = await requireAdminActor();
  const id = text(formData, "id");
  const role = text(formData, "role") || "user";
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, role: true } });
  if (!target || !canManageRoles(actor, target)) throw new Error("Sem permissao para alterar este usuario.");
  if (role === "owner" && !actor.isOwner) throw new Error("Somente owner pode atribuir role owner.");
  if (target.id === actor.id && role !== "admin" && !actor.isOwner) throw new Error("Voce nao pode remover seu proprio acesso.");
  const after = await prisma.user.update({ where: { id }, data: { role } });
  await writeAdminAuditLog({ actor, action: "user.role", entityType: "User", entityId: id, before: { role: target.role }, after: { role: after.role } });
  revalidatePath("/admin/usuarios");
}

export async function toggleUserBanAction(formData: FormData) {
  const actor = await requireAdminActor();
  const id = text(formData, "id");
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, banned: true } });
  if (target?.id === actor.id) throw new Error("Voce nao pode banir a propria conta.");
  if (!target || isOwnerEmail(target.email)) throw new Error("Usuario protegido.");
  const after = await prisma.user.update({
    where: { id },
    data: {
      banned: !target.banned,
      banReason: !target.banned ?nullableText(formData, "banReason") || "Acao administrativa" : null,
      bannedAt: !target.banned ?new Date() : null,
      bannedById: !target.banned ?actor.id : null,
    },
  });
  await writeAdminAuditLog({ actor, action: after.banned ?"user.ban" : "user.unban", entityType: "User", entityId: id });
  revalidatePath("/admin/usuarios");
}

export async function createAnnouncementAction(formData: FormData) {
  const actor = await requireAdminActor();
  const title = text(formData, "title");
  const content = text(formData, "content");
  if (!title || !content) throw new Error("Titulo e mensagem sao obrigatorios.");
  const row = await prisma.announcement.create({ data: { title, content } });
  await writeAdminAuditLog({ actor, action: "system.announcement", entityType: "Announcement", entityId: row.id, after: { title } });
  revalidatePath("/admin/sistema");
}

export async function updateMaintenanceAction(formData: FormData) {
  const actor = await requireAdminActor();
  const enabled = boolValue(formData, "enabled");
  const message = text(formData, "message") || "Estamos em manutencao. Voltamos em breve.";
  const state = await setMaintenanceState(enabled, message);
  await writeAdminAuditLog({ actor, action: "system.maintenance", entityType: "System", entityId: "maintenance", after: state });
  revalidatePath("/admin/sistema");
  revalidatePath("/");
}

export async function createContentAction(formData: FormData) {
  const actor = await requireAdminActor();
  const title = text(formData, "title");
  if (!title) throw new Error("Titulo obrigatorio.");
  const slug = text(formData, "slug") || slugify(title);
  const content = await prisma.content.create({
    data: {
      title,
      slug,
      kind: text(formData, "kind") || "anime",
      status: normalizeContentStatus(text(formData, "status") || "draft"),
      synopsis: nullableText(formData, "synopsis"),
      posterUrl: nullableText(formData, "posterUrl"),
      bannerUrl: nullableText(formData, "bannerUrl"),
      genres: parseGenres(text(formData, "genres")) as any,
      year: intValue(formData, "year"),
      ageRating: nullableText(formData, "ageRating"),
      language: nullableText(formData, "language"),
      isFeatured: boolValue(formData, "isFeatured"),
      createdById: actor.id,
      externalIds: { provider: text(formData, "provider") || "manual" } as any,
    },
  });
  await writeAdminAuditLog({ actor, action: "content.create", entityType: "Content", entityId: content.id, after: { title, status: content.status } });
  revalidatePath("/admin");
  revalidatePath("/admin/catalogo");
  revalidatePath("/inicio");
  revalidatePath("/explorar");
}

export async function updateContentStatusAction(formData: FormData) {
  const actor = await requireAdminActor();
  const id = text(formData, "id");
  if (!id) throw new Error("ID obrigatorio.");
  const before = await prisma.content.findUnique({ where: { id }, select: { id: true, title: true, status: true } });
  const status = normalizeContentStatus(text(formData, "status"));
  const after = await prisma.content.update({ where: { id }, data: { status } });
  await writeAdminAuditLog({ actor, action: "content.status", entityType: "Content", entityId: id, before, after: { status: after.status } });
  revalidatePath("/admin/catalogo");
  revalidatePath("/inicio");
  revalidatePath("/explorar");
}

export async function deleteContentAction(formData: FormData) {
  const actor = await requireAdminActor();
  if (!canUseDestructiveAdminAction(actor)) throw new Error("Sem permissao para excluir.");
  const id = text(formData, "id");
  if (!id || text(formData, "confirm") !== "EXCLUIR") throw new Error("Confirmacao invalida.");
  const before = await prisma.content.findUnique({ where: { id }, select: { id: true, title: true, status: true } });
  await prisma.content.delete({ where: { id } });
  await writeAdminAuditLog({ actor, action: "content.delete", entityType: "Content", entityId: id, before });
  revalidatePath("/admin/catalogo");
  revalidatePath("/inicio");
}

export async function createCanonicalSeasonAction(formData: FormData) {
  const actor = await requireAdminActor();
  const contentId = text(formData, "contentId");
  const seasonNumber = intValue(formData, "seasonNumber");
  if (!contentId || !seasonNumber || seasonNumber <= 0) throw new Error("Conteudo e temporada sao obrigatorios.");
  const season = await prisma.season.upsert({
    where: { contentId_seasonNumber: { contentId, seasonNumber } },
    create: {
      contentId,
      seasonNumber,
      title: nullableText(formData, "title"),
      synopsis: nullableText(formData, "synopsis"),
      posterUrl: nullableText(formData, "posterUrl"),
      status: normalizeContentStatus(text(formData, "status") || "draft"),
    },
    update: {
      title: nullableText(formData, "title"),
      synopsis: nullableText(formData, "synopsis"),
      posterUrl: nullableText(formData, "posterUrl"),
      status: normalizeContentStatus(text(formData, "status") || "draft"),
    },
  });
  await writeAdminAuditLog({ actor, action: "season.upsert", entityType: "Season", entityId: season.id, contentId, after: { seasonNumber } });
  revalidatePath("/admin/temporadas");
  revalidatePath("/admin/episodios");
}

export async function createCanonicalEpisodeAction(formData: FormData) {
  const actor = await requireAdminActor();
  const contentId = text(formData, "contentId");
  const seasonId = nullableText(formData, "seasonId");
  const episodeNumber = intValue(formData, "episodeNumber");
  if (!contentId || !episodeNumber || episodeNumber <= 0) throw new Error("Conteudo e numero sao obrigatorios.");
  const title = text(formData, "title") || `Episodio ${episodeNumber}`;
  const episode = await prisma.catalogEpisode.create({
    data: {
      contentId,
      seasonId,
      episodeNumber,
      slug: text(formData, "slug") || slugify(title),
      title,
      synopsis: nullableText(formData, "synopsis"),
      thumbnailUrl: nullableText(formData, "thumbnailUrl"),
      durationSec: intValue(formData, "durationSec"),
      status: normalizeContentStatus(text(formData, "status") || "draft"),
    },
  });
  await writeAdminAuditLog({ actor, action: "episode.create", entityType: "CatalogEpisode", entityId: episode.id, contentId, after: { episodeNumber, title } });
  revalidatePath("/admin/episodios");
}

export async function updateCanonicalEpisodeStatusAction(formData: FormData) {
  const actor = await requireAdminActor();
  const id = text(formData, "id");
  const status = normalizeContentStatus(text(formData, "status"));
  if (!id) throw new Error("ID obrigatorio.");
  const after = await prisma.catalogEpisode.update({ where: { id }, data: { status } });
  await writeAdminAuditLog({ actor, action: "episode.status", entityType: "CatalogEpisode", entityId: id, contentId: after.contentId, after: { status } });
  revalidatePath("/admin/episodios");
}

export async function createCanonicalSourceAction(formData: FormData) {
  const actor = await requireAdminActor();
  const episodeId = text(formData, "episodeId");
  const url = text(formData, "url");
  const storagePath = text(formData, "storagePath");
  if (!episodeId || (!url && !storagePath)) throw new Error("Episodio e URL/storage path sao obrigatorios.");
  const episode = await prisma.catalogEpisode.findUnique({ where: { id: episodeId }, select: { contentId: true } });
  if (!episode) throw new Error("Episodio nao encontrado.");
  const sourceType = normalizeSourceType(text(formData, "sourceType") || url || storagePath);
  const source = await prisma.source.create({
    data: {
      episodeId,
      contentId: episode.contentId,
      provider: text(formData, "provider") || "manual",
      sourceType,
      url: url || null,
      storagePath: storagePath || null,
      quality: nullableText(formData, "quality"),
      language: nullableText(formData, "language"),
      priority: intValue(formData, "priority") || 100,
      isActive: boolValue(formData, "isActive"),
      lastCheckedAt: new Date(),
    },
  });
  await writeAdminAuditLog({ actor, action: "source.create", entityType: "Source", entityId: source.id, contentId: episode.contentId, after: { sourceType, provider: source.provider } });
  revalidatePath("/admin/episodios");
}

export async function toggleCanonicalSourceAction(formData: FormData) {
  const actor = await requireAdminActor();
  const id = text(formData, "id");
  if (!id) throw new Error("ID obrigatorio.");
  const current = await prisma.source.findUnique({ where: { id }, select: { isActive: true, contentId: true } });
  const after = await prisma.source.update({ where: { id }, data: { isActive: !current?.isActive, lastCheckedAt: new Date() } });
  await writeAdminAuditLog({ actor, action: "source.toggle", entityType: "Source", entityId: id, contentId: current?.contentId || null, after: { isActive: after.isActive } });
  revalidatePath("/admin/episodios");
}

export async function createProviderSyncLogAction(formData: FormData) {
  const actor = await requireAdminActor();
  const provider = text(formData, "provider") || "manual";
  const contentId = nullableText(formData, "contentId");
  const status = text(formData, "status") || "preview";
  const log = await prisma.providerSyncLog.create({
    data: {
      provider,
      contentId,
      status,
      scope: text(formData, "scope") || "diff-preview",
      summary: { note: text(formData, "summary") || "Preview de sincronizacao sem sobrescrever dados manuais." } as any,
      diff: {
        newEpisodes: intValue(formData, "newEpisodes") || 0,
        changedEpisodes: intValue(formData, "changedEpisodes") || 0,
        removedInApi: intValue(formData, "removedInApi") || 0,
        manualProtected: true,
      } as any,
      createdById: actor.id,
    },
  });
  await writeAdminAuditLog({ actor, action: "sync.preview", entityType: "ProviderSyncLog", entityId: log.id, contentId, after: { provider, status } });
  revalidatePath("/admin/sync");
}

export async function upsertSystemSettingAction(formData: FormData) {
  const actor = await requireAdminActor();
  const key = text(formData, "key");
  if (!key) throw new Error("Chave obrigatoria.");
  const enabled = boolValue(formData, "enabled");
  const value = { enabled, message: nullableText(formData, "message") } as any;
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value, updatedBy: actor.id },
    update: { value, updatedBy: actor.id },
  });
  await writeAdminAuditLog({ actor, action: "system.setting", entityType: "SystemSetting", entityId: key, after: value });
  revalidatePath("/admin/sistema");
}
