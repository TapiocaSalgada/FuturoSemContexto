"use client";

import AppLayout from "@/components/AppLayout";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { Play, Heart, MessageSquare, Send, CornerDownRight, Edit3, Trash2, Check, X, FolderOpen, ChevronDown, Star, Loader2, Clock3, AlertTriangle, Eye, Bookmark } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface Comment {
  id: string; content: string; createdAt: string; updatedAt: string;
  user: { id: string; name: string; avatarUrl?: string };
  replies: Comment[];
}
interface Folder { id: string; name: string }
interface Anime {
  id: string; title: string; description?: string; coverImage?: string; bannerImage?: string;
  status: string; visibility: string;
  viewerCount?: number;
  categories: { id: string; name: string }[];
  episodes: { id: string; title: string; number: number; season: number; duration?: string; videoUrl?: string; thumbnailUrl?: string }[];
}

function accentFromSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const lightness = 72 + (Math.abs(hash) % 10);
  return `hsl(220 12% ${lightness}%)`;
}

function parseImportMeta(description?: string | null) {
  if (!description) {
    return {
      cleanDescription: "",
      meta: {} as Record<string, string>,
    };
  }

  const markerMatch = description.match(/\[import-meta\s+([^\]]+)\]/i);
  const marker = markerMatch?.[1] || "";

  if (!marker) {
    return {
      cleanDescription: description,
      meta: {} as Record<string, string>,
    };
  }

  const meta = marker
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const [key, ...rest] = part.split("=");
      if (!key || rest.length === 0) return acc;
      acc[key.trim().toLowerCase()] = rest.join("=").trim();
      return acc;
    }, {});

  return {
    cleanDescription: description.replace(markerMatch?.[0] || "", "").trim(),
    meta,
  };
}

function CommentItem({ comment, animeId, currentUserId, onRefresh }: {
  comment: Comment; animeId: string; currentUserId?: string; onRefresh: () => void
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  const handleReply = async () => {
    if (!replyContent.trim()) return;
    await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ animeId, content: replyContent, parentId: comment.id }) });
    setReplyContent(""); setReplyOpen(false); onRefresh();
  };
  const handleEdit = async () => {
    await fetch("/api/comments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: comment.id, content: editContent }) });
    setEditing(false); onRefresh();
  };
  const handleDelete = async () => {
    if (!confirm("Apagar comentÃ¡rio?")) return;
    await fetch("/api/comments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: comment.id }) });
    onRefresh();
  };

  const isOwn = currentUserId === comment.user.id;

  return (
    <div className="space-y-2">
      <div className="flex gap-3 group">
        <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0 mt-0.5 border border-[var(--border-subtle)]">
          <Image src={comment.user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user.name)}&background=333&color=fff`} fill sizes="34px" className="object-cover" alt={comment.user.name} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/profile/${comment.user.id}`} className="font-bold text-sm text-white hover:text-[var(--text-accent)] transition">{comment.user.name}</Link>
            <span className="text-xs text-[var(--text-muted)]">{new Date(comment.createdAt).toLocaleDateString("pt-BR")}</span>
            {comment.updatedAt !== comment.createdAt && <span className="text-xs text-[var(--text-muted)]">(editado)</span>}
          </div>
          {editing ? (
            <div className="mt-1 flex items-start gap-2">
              <textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="kdr-input flex-1 rounded-lg px-3 py-2 text-sm resize-none min-h-[60px]" />
              <div className="flex flex-col gap-1">
                <button onClick={handleEdit} className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition"><Check size={14} /></button>
                <button onClick={() => setEditing(false)} className="p-2 bg-[var(--bg-card)] text-[var(--text-muted)] rounded-lg hover:bg-white/10 transition"><X size={14} /></button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)] mt-0.5 leading-relaxed">{comment.content}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5">
            {currentUserId && (
              <button onClick={() => setReplyOpen(!replyOpen)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-accent)] transition flex items-center gap-1">
                <CornerDownRight size={12} /> Responder
              </button>
            )}
            {isOwn && !editing && (
              <>
                <button onClick={() => setEditing(true)} className="text-xs text-[var(--text-muted)] hover:text-blue-400 transition flex items-center gap-1"><Edit3 size={12} /> Editar</button>
                <button onClick={handleDelete} className="text-xs text-[var(--text-muted)] hover:text-red-400 transition flex items-center gap-1"><Trash2 size={12} /> Apagar</button>
              </>
            )}
          </div>
          {replyOpen && (
            <div className="mt-2 flex items-start gap-2">
              <input value={replyContent} onChange={e => setReplyContent(e.target.value)} onKeyDown={e => e.key === "Enter" && handleReply()}
                placeholder="Sua resposta..." className="kdr-input flex-1 rounded-lg px-3 py-2 text-sm" />
              <button onClick={handleReply} className="kdr-btn-primary p-2 rounded-lg"><Send size={14} /></button>
            </div>
          )}
        </div>
      </div>
      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-11 space-y-3 border-l-2 border-[var(--border-subtle)] pl-4">
          {comment.replies.map(r => (
            <CommentItem key={r.id} comment={r} animeId={animeId} currentUserId={currentUserId} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AnimePageClient() {
  const { data: session } = useSession();
  const params = useParams();
  const id = params?.id as string;

  const [anime, setAnime] = useState<Anime | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isFavorited, setIsFavorited] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [groupedEps, setGroupedEps] = useState<Record<number, typeof anime extends null ? never[] : Anime["episodes"]>>({});
  const [lastWatchedEpId, setLastWatchedEpId] = useState<string | null>(null);

  const [ratingData, setRatingData] = useState<{ average: number | null; total: number; userRating: number | null }>({
    average: null, total: 0, userRating: null,
  });
  const [ratingHover, setRatingHover] = useState(0);
  const [isWatchLater, setIsWatchLater] = useState(false);
  const [watchLaterFolderId, setWatchLaterFolderId] = useState<string | null>(null);
  const [watchLaterLoading, setWatchLaterLoading] = useState(false);
  const [showBugModal, setShowBugModal] = useState(false);
  const [showCommentsQuickModal, setShowCommentsQuickModal] = useState(false);
  const [bugSending, setBugSending] = useState(false);
  const [bugMsg, setBugMsg] = useState<{ text: string; type: "ok" | "err" }>({ text: "", type: "ok" });
  const [bugForm, setBugForm] = useState({ title: "", description: "", episodeId: "" });
  const [episodeLayout, setEpisodeLayout] = useState<"default" | "compact" | "list">("default");
  const [episodeFilter, setEpisodeFilter] = useState("");

  const handleRate = async (star: number) => {
    if (!id || !session) return;
    const res = await fetch("/api/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ animeId: id, rating: star }),
    });
    const updated = await res.json();
    if (updated.ok !== false) setRatingData(updated);
  };

  const loadComments = useCallback(() => {
    if (!id) return;
    fetch(`/api/comments?animeId=${id}`).then(r => r.json()).then(setComments);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const abort = new AbortController();

    fetch(`/api/ratings?animeId=${id}`, { signal: abort.signal }).then(r => r.json()).then(setRatingData).catch(() => {});

    fetch(`/api/anime/${id}`, { signal: abort.signal }).then(r => r.json()).then((a: Anime) => {
      setAnime(a);
      const grouped: Record<number, Anime["episodes"]> = {};
      a.episodes.forEach(ep => {
        if (!grouped[ep.season]) grouped[ep.season] = [];
        grouped[ep.season].push(ep);
      });
      setGroupedEps(grouped as any);
    }).catch(() => {});

    loadComments();
    if (session) {
      (async () => {
        const [favs, foldersRes, historyRes] = await Promise.all([
          fetch("/api/favorites", { signal: abort.signal }).then(r => r.json()).catch(() => []),
          fetch("/api/favorites/folders", { signal: abort.signal }).then(r => r.json()).catch(() => []),
          fetch(`/api/history?animeId=${id}`, { signal: abort.signal }).then(r => r.json()).catch(() => null),
        ]);

        setIsFavorited(Array.isArray(favs) && favs.some((f: any) => f.animeId === id));
        const foldersArr = Array.isArray(foldersRes) ? foldersRes : [];
        setFolders(foldersArr);
        const watchFolder = foldersArr.find((f: any) => f.name?.toLowerCase() === "assistir depois" || f.name?.toLowerCase() === "watch later");
        if (watchFolder) {
          const wl = (Array.isArray(favs) ? favs : []).find((f: any) => f.animeId === id && f.favoriteFolderId === watchFolder.id);
          if (wl) setIsWatchLater(true);
          setWatchLaterFolderId(watchFolder.id);
        }
        if (historyRes?.episodeId) setLastWatchedEpId(historyRes.episodeId);
      })();
    }

    return () => abort.abort();
  }, [id, session, loadComments]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = String(localStorage.getItem("anime-episodes-layout-v1") || "").trim();
    if (saved === "default" || saved === "compact" || saved === "list") {
      setEpisodeLayout(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("anime-episodes-layout-v1", episodeLayout);
  }, [episodeLayout]);

  const handleFavorite = async () => {
    if (!session) return;
    if (!isFavorited && folders.length > 0) {
      setShowFolderPicker(true);
      return;
    }
    const res = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ animeId: id, folderId: null }) });
    const data = await res.json();
    setIsFavorited(data.favorited);
  };

  const confirmFavoriteWithFolder = async () => {
    const res = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ animeId: id, folderId: selectedFolder || null }) });
    const data = await res.json();
    setIsFavorited(data.favorited);
    setShowFolderPicker(false);
  };

  const handleWatchLater = async () => {
    if (!session) return;
    setWatchLaterLoading(true);
    try {
      let folderId = watchLaterFolderId;
      if (!folderId) {
        const resCreate = await fetch("/api/favorites/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Assistir depois", isPrivate: true }),
        });
        if (resCreate.ok) {
          const folder = await resCreate.json();
          folderId = folder.id;
          setWatchLaterFolderId(folder.id);
          setFolders((prev) => [...prev, folder]);
        }
      }

      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeId: id, folderId: folderId || null }),
      });
      const data = await res.json();
      if (data.favorited) {
        setIsWatchLater(true);
      } else {
        setIsWatchLater(false);
      }
    } finally {
      setWatchLaterLoading(false);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ animeId: id, content: newComment }) });
    setNewComment("");
    loadComments();
  };

  const addEmoji = (emoji: string) => setNewComment(prev => prev + emoji);

  const openCommentsQuickModal = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      jumpToComments();
      return;
    }
    setShowCommentsQuickModal(true);
  };

  const jumpToComments = () => {
    setShowCommentsQuickModal(false);
    if (typeof window === "undefined") return;
    const section = document.getElementById("anime-comments");
    if (!section) return;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openBugModal = () => {
    setBugMsg({ text: "", type: "ok" });
    setBugForm((prev) => ({
      title: prev.title || `Bug em ${anime?.title || "anime"}`,
      description: "",
      episodeId: "",
    }));
    setShowBugModal(true);
  };

  const handleBugReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !anime) return;
    if (!bugForm.description.trim() || bugForm.description.trim().length < 8) {
      setBugMsg({ text: "Descreva melhor o problema (mÃ­nimo 8 caracteres).", type: "err" });
      return;
    }

    setBugSending(true);
    setBugMsg({ text: "", type: "ok" });
    try {
      const res = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animeId: anime.id,
          episodeId: bugForm.episodeId || null,
          title: bugForm.title.trim() || `Bug em ${anime.title}`,
          description: bugForm.description.trim(),
          pagePath: window.location.pathname,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBugMsg({ text: payload?.error || "Falha ao enviar bug.", type: "err" });
        return;
      }

      setBugMsg({ text: "Bug enviado! Obrigado por reportar.", type: "ok" });
      setTimeout(() => {
        setShowBugModal(false);
        setBugForm({ title: "", description: "", episodeId: "" });
      }, 900);
    } catch {
      setBugMsg({ text: "Erro ao enviar bug.", type: "err" });
    } finally {
      setBugSending(false);
    }
  };


  const currentUserId = (session?.user as any)?.id;
  const accentColor = anime
    ? accentFromSeed(`${anime.id}-${anime.bannerImage || anime.coverImage || anime.title}`)
    : "#e2e8f0";
  const accentSoft = accentColor.startsWith("hsl(") ? accentColor.replace(")", " / 0.15)") : accentColor;
  const accentBorder = accentColor.startsWith("hsl(") ? accentColor.replace(")", " / 0.35)") : accentColor;
  const accentGlow = accentColor.startsWith("hsl(") ? accentColor.replace(")", " / 0.25)") : accentColor;
  const importMeta = parseImportMeta(anime?.description);
  const sourceUrl = importMeta.meta.url || importMeta.meta.originurl || importMeta.meta.originalurl || "";
  const sourceProvider = importMeta.meta.provider || "";

  useEffect(() => {
    if (!anime) return;
    const root = document.documentElement;
    const previousAccent = root.style.getPropertyValue("--accent");
    root.style.setProperty("--accent", accentColor);

    return () => {
      if (previousAccent) root.style.setProperty("--accent", previousAccent);
      else root.style.removeProperty("--accent");
    };
  }, [anime, accentColor]);

  if (!anime) return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="kdr-spinner" />
        <p className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest">Carregando anime...</p>
      </div>
    </AppLayout>
  );

  const seasons = Object.keys(groupedEps).map(Number).sort();
  const normalizedEpisodeFilter = episodeFilter.trim().toLowerCase();
  const filteredEpisodesBySeason = (() => {
    const result: Record<number, Anime["episodes"]> = {};
    for (const season of seasons) {
      const list = (groupedEps[season] as Anime["episodes"] || []).filter((episode) => {
        if (!normalizedEpisodeFilter) return true;
        const title = String(episode.title || "").toLowerCase();
        return (
          title.includes(normalizedEpisodeFilter) ||
          String(episode.number).includes(normalizedEpisodeFilter) ||
          String(episode.season).includes(normalizedEpisodeFilter)
        );
      });
      result[season] = list;
    }
    return result;
  })();
  const hasEpisodeResults = seasons.some(
    (season) => (filteredEpisodesBySeason[season]?.length || 0) > 0,
  );
  const createdYear = (() => {
    const raw = (anime as any)?.createdAt;
    const parsed = raw ? new Date(raw) : null;
    return parsed && Number.isFinite(parsed.getTime()) ? String(parsed.getFullYear()) : "2025";
  })();
  const viewerCount = Math.max(0, Number(anime.viewerCount || 0));
  const pseudoLikes = Math.max(1, Math.round((ratingData.total || 1) * 0.65));
  const ratingOutOf10 = ratingData.average ? Number((ratingData.average * 2).toFixed(1)) : 0;
  const mediaTypeLabel = anime.episodes.length >= 12 ? "SÃ©rie de TV" : "Especial";

  return (
    <AppLayout>
      {/* Folder Picker Modal */}
      {showFolderPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowFolderPicker(false)} />
          <div className="relative glass-surface-heavy border border-white/12 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2"><FolderOpen size={18} className="kdr-section-title-accent" /> Adicionar Ã  Pasta</h3>
            <div className="relative">
              <select value={selectedFolder} onChange={e => setSelectedFolder(e.target.value)}
                className="w-full bg-black/35 border border-white/12 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/30 transition appearance-none">
                <option value="">Sem pasta</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={confirmFavoriteWithFolder} className="flex-1 bg-white hover:bg-zinc-100 text-black font-black py-2.5 rounded-full text-sm transition flex items-center justify-center gap-2">
                <Heart size={14} /> Favoritar
              </button>
              <button onClick={() => setShowFolderPicker(false)} className="px-4 py-2.5 bg-black/35 border border-white/12 text-zinc-400 hover:text-white rounded-lg text-sm transition">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showBugModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowBugModal(false)} />
          <div className="relative glass-surface-heavy border border-white/12 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-black text-lg flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-400" /> Reportar bug
              </h3>
              <button onClick={() => setShowBugModal(false)} className="text-zinc-500 hover:text-white transition">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBugReportSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-zinc-400 mb-1 block">TÃ­tulo</label>
                <input
                  value={bugForm.title}
                  onChange={(e) => setBugForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400"
                  placeholder="Ex: VÃ­deo nÃ£o carrega no episÃ³dio 3"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-400 mb-1 block">EpisÃ³dio (opcional)</label>
                <select
                  value={bugForm.episodeId}
                  onChange={(e) => setBugForm((prev) => ({ ...prev, episodeId: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400"
                >
                  <option value="">Sem episÃ³dio especÃ­fico</option>
                  {anime.episodes.map((episode) => (
                    <option key={episode.id} value={episode.id}>
                      T{episode.season}E{episode.number} - {episode.title || `EpisÃ³dio ${episode.number}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-400 mb-1 block">DescriÃ§Ã£o *</label>
                <textarea
                  value={bugForm.description}
                  onChange={(e) => setBugForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400 min-h-[100px] resize-none"
                  placeholder="Descreva o que aconteceu, dispositivo/navegador e como reproduzir."
                />
              </div>

              {bugMsg.text && (
                <p className={`text-xs font-bold ${bugMsg.type === "ok" ? "text-green-400" : "text-red-400"}`}>
                  {bugMsg.text}
                </p>
              )}

              <button
                type="submit"
                disabled={bugSending}
                className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-sm transition disabled:opacity-60"
              >
                {bugSending ? "Enviando..." : "Enviar bug"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showCommentsQuickModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCommentsQuickModal(false)} />
          <div className="relative glass-surface-heavy border border-white/12 rounded-2xl p-5 w-full max-w-xl space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-black text-lg flex items-center gap-2">
                <MessageSquare size={18} className="kdr-section-title-accent" /> ComentÃ¡rios recentes
              </h3>
              <button onClick={() => setShowCommentsQuickModal(false)} className="text-zinc-500 hover:text-white transition">
                <X size={18} />
              </button>
            </div>

            {comments.length === 0 ? (
              <p className="text-sm text-zinc-400">Ainda nÃ£o existem comentÃ¡rios para este anime.</p>
            ) : (
              <div className="max-h-[52vh] overflow-y-auto space-y-2 pr-1">
                {comments.slice(0, 8).map((comment) => (
                  <div key={comment.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-white truncate">{comment.user.name}</p>
                      <p className="text-[11px] text-zinc-500 shrink-0">{new Date(comment.createdAt).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <p className="text-sm text-zinc-300 mt-1 line-clamp-3">{comment.content}</p>
                    {comment.replies?.length ? (
                      <p className="text-[11px] text-zinc-500 mt-1">{comment.replies.length} resposta(s)</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={jumpToComments}
                  className="flex-1 px-3 py-2 rounded-full bg-white hover:bg-zinc-100 text-black text-sm font-black transition"
                >
                  Ir para seÃ§Ã£o completa
                </button>
              <button
                type="button"
                onClick={() => setShowCommentsQuickModal(false)}
                className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-bold transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pb-28 md:pb-24">
        <div className="relative w-full overflow-hidden rounded-none lg:rounded-[30px] border-0 lg:border lg:border-[var(--border-subtle)] aspect-[16/12] sm:aspect-[16/9] lg:aspect-[16/7] max-h-[82vh]">
          <img
            src={anime.bannerImage || anime.coverImage || ""}
            className="w-full h-full object-cover [filter:saturate(1.04)_brightness(0.68)]"
            alt={anime.title}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/45 to-black/8" />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--background)]/72 via-[var(--background)]/24 to-transparent" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accentSoft} 0%, transparent 48%)` }} />

          <div className="absolute inset-x-0 bottom-0 z-10 px-3 sm:px-6 lg:px-10 pb-5 sm:pb-6">
            <div className="max-w-[1320px] mx-auto grid grid-cols-1 lg:grid-cols-[170px_minmax(0,1fr)] gap-4 lg:gap-6 items-end">
              <div className="hidden sm:block space-y-3">
                <div className="rounded-2xl overflow-hidden border border-white/20 shadow-[0_14px_38px_rgba(0,0,0,0.55)]">
                  <img src={anime.coverImage || ""} alt={anime.title} className="w-full aspect-[2/3] object-cover" />
                </div>
                <div className="h-9 rounded-full border border-white/12 bg-black/42 backdrop-blur-md flex items-center justify-between px-3">
                  <button type="button" className="w-6 h-6 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition">â€¹</button>
                  <span className="w-8 h-1 rounded-full" style={{ backgroundColor: accentColor }} />
                  <button type="button" className="w-6 h-6 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition">â€º</button>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/46 backdrop-blur-md p-4 sm:p-5 lg:p-6 shadow-[0_16px_44px_rgba(0,0,0,0.42)]">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black border uppercase tracking-[0.05em] ${anime.status === "ongoing" ? "bg-emerald-500/20 text-emerald-100 border-emerald-400/35" : "bg-violet-500/20 text-violet-100 border-violet-300/35"}`}>
                    {anime.status === "ongoing" ? "Em lanÃ§amento" : "Finalizado"}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-black border border-white/18 bg-white/5 text-zinc-200 uppercase tracking-[0.05em]">
                    {mediaTypeLabel}
                  </span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[0.95]">
                  {anime.title}
                </h1>

                <p id="anime-sinopse" className="mt-3 text-[var(--text-secondary)] leading-relaxed text-sm lg:text-base break-words line-clamp-3 scroll-mt-28">
                  {importMeta.cleanDescription || "Nenhuma sinopse disponÃ­vel."}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-zinc-900/70 border border-zinc-700 text-zinc-300 font-bold inline-flex items-center gap-1.5">ðŸ“… {createdYear}</span>
                  <span className="px-2.5 py-1 rounded-full bg-zinc-900/70 border border-zinc-700 text-zinc-300 font-bold inline-flex items-center gap-1.5">ðŸŽ¬ {mediaTypeLabel}</span>
                  <span className="px-2.5 py-1 rounded-full bg-zinc-900/70 border border-zinc-700 text-zinc-200 font-bold inline-flex items-center gap-1.5">
                    <Star size={12} className="text-yellow-300 fill-yellow-300" /> {ratingOutOf10.toFixed(1)}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-zinc-900/70 border border-zinc-700 text-zinc-300 font-bold">({ratingData.total} votos)</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {anime.categories.slice(0, 6).map((category) => (
                    <span key={category.id} className="px-2.5 py-1 rounded-full text-[11px] border border-white/14 bg-black/35 text-zinc-200 font-black uppercase tracking-[0.05em]">
                      {category.name}
                    </span>
                  ))}
                </div>

                {(sourceProvider || (typeof sourceUrl === "string" && sourceUrl.startsWith("http"))) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {sourceProvider && (
                      <span className="px-2.5 py-1 rounded-full bg-zinc-800/80 border border-zinc-700 text-zinc-300 uppercase tracking-wide font-bold">
                        Fonte: {sourceProvider}
                      </span>
                    )}
                    {typeof sourceUrl === "string" && sourceUrl.startsWith("http") && (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-zinc-200 hover:bg-white hover:text-black transition font-bold"
                      >
                        Site original
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 mt-5 space-y-8">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/48 backdrop-blur-md overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-7">
                <div className="col-span-2 sm:col-span-3 lg:col-span-3 p-3 border-b sm:border-b-0 sm:border-r border-white/10 space-y-2">
                  {anime.episodes.length > 0 && (() => {
                    const lastWatchedEp = anime.episodes.find((episode) => episode.id === lastWatchedEpId);
                    return (
                      <Link
                        prefetch={true}
                        href={`/watch/${lastWatchedEpId || anime.episodes[0]?.id}`}
                        className="w-full h-10 rounded-xl inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-black transition shadow-[0_8px_20px_rgba(229,9,20,0.35)]"
                      >
                        <Play fill="currentColor" size={15} />
                        {lastWatchedEp ? `Continuar Ep ${lastWatchedEp.number}` : "Assistir agora"}
                      </Link>
                    );
                  })()}

                  <button
                    onClick={session ? handleFavorite : undefined}
                    disabled={!session}
                    className={`w-full h-10 rounded-xl inline-flex items-center justify-center gap-2 text-sm font-black transition border ${
                      isFavorited
                        ? "bg-red-500/18 border-red-400/40 text-red-100"
                        : "border-white/12 bg-white/5 text-zinc-200 hover:bg-white/10"
                    } ${!session ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <Bookmark size={15} className={isFavorited ? "fill-current" : ""} />
                    Salvar na lista
                  </button>
                </div>

                <div className="flex flex-col items-center justify-center border-r border-b sm:border-b-0 border-white/10 py-3.5 px-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-black">VisualizaÃ§Ãµes</p>
                  <p className="text-base font-black text-white mt-0.5 inline-flex items-center gap-1"><Eye size={13} className="text-zinc-300" /> {viewerCount}</p>
                </div>

                <div className="flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-white/10 py-3.5 px-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-black">Gostos</p>
                  <p className="text-base font-black text-white mt-0.5 inline-flex items-center gap-1"><Heart size={13} className="text-red-300" /> {pseudoLikes}</p>
                </div>

                <div className="col-span-2 sm:col-span-1 lg:col-span-2 flex items-center justify-center gap-2 py-3.5 px-2">
                  <button
                    type="button"
                    onClick={openCommentsQuickModal}
                    className="w-9 h-9 rounded-lg border border-white/12 bg-white/5 text-zinc-200 hover:text-white hover:bg-white/12 transition"
                    title="ComentÃ¡rios"
                  >
                    <MessageSquare size={16} className="mx-auto" />
                  </button>
                  <button
                    type="button"
                    onClick={session ? handleWatchLater : undefined}
                    disabled={!session || watchLaterLoading}
                    className={`w-9 h-9 rounded-lg border transition ${
                      isWatchLater
                        ? "border-emerald-400/40 bg-emerald-500/16 text-emerald-100"
                        : "border-white/12 bg-white/5 text-zinc-200 hover:text-white hover:bg-white/12"
                    } ${!session ? "opacity-60 cursor-not-allowed" : ""}`}
                    title="Assistir depois"
                  >
                    {watchLaterLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : <Clock3 size={16} className="mx-auto" />}
                  </button>
                  <button
                    type="button"
                    onClick={session ? openBugModal : undefined}
                    disabled={!session}
                    className="w-9 h-9 rounded-lg border border-white/12 bg-white/5 text-zinc-200 hover:text-white hover:bg-white/12 transition disabled:opacity-50"
                    title="Reportar bug"
                  >
                    <AlertTriangle size={16} className="mx-auto" />
                  </button>
                </div>
              </div>
            </div>

            <aside className="border border-white/12 rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-black/70 via-black/58 to-violet-600/20 backdrop-blur-md shadow-[0_12px_36px_rgba(0,0,0,0.42)]">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)] font-black">AvaliaÃ§Ã£o</p>
              <div className="mt-2 flex items-end gap-2">
                <p className="text-4xl leading-none font-black text-white">{ratingOutOf10.toFixed(1)}</p>
                <p className="text-sm text-[var(--text-muted)] font-bold mb-1">/10</p>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">{ratingData.total} voto(s)</p>

              <div className="mt-4 flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = star <= (ratingHover || ratingData.userRating || 0);
                  return (
                    <button
                      key={star}
                      onClick={() => session && handleRate(star)}
                      onMouseEnter={() => session && setRatingHover(star)}
                      onMouseLeave={() => session && setRatingHover(0)}
                      disabled={!session}
                      className={`transition-transform ${session ? "hover:scale-110" : "opacity-50 cursor-not-allowed"}`}
                      title={session ? `Dar nota ${star}` : "Entre para avaliar"}
                    >
                      <Star size={22} className={active ? "text-yellow-400 fill-yellow-400" : "text-zinc-600"} />
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={openCommentsQuickModal}
                className="mt-4 w-full h-10 rounded-xl border border-white/15 bg-white/10 hover:bg-white/18 text-white text-sm font-black transition"
              >
                Avaliar e comentÃ¡rios
              </button>

              {ratingData.userRating && session && (
                <p className="mt-3 text-xs font-bold text-zinc-200">Sua nota: {ratingData.userRating}</p>
              )}
              {!session && (
                <p className="mt-3 text-[11px] text-zinc-500">Entre para avaliar este anime.</p>
              )}
            </aside>
          </div>

          {/* Episodes by Season */}
          {anime.episodes.length > 0 && (
            <div id="anime-episodios" className="scroll-mt-28">
              <div className="mb-5 space-y-3">
                <h2 className="kdr-section-title"><Play size={16} className="kdr-section-title-accent" /> Episodios</h2>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                  <input
                    value={episodeFilter}
                    onChange={(event) => setEpisodeFilter(event.target.value)}
                    placeholder="Buscar episodio por titulo/numero..."
                    className="kdr-input w-full sm:max-w-sm rounded-xl px-3 py-2.5 text-sm"
                  />
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                    <button
                      type="button"
                      onClick={() => setEpisodeLayout("list")}
                      className={`h-9 px-3 rounded-lg border text-xs font-black whitespace-nowrap transition ${
                        episodeLayout === "list"
                          ? "bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent-border)]"
                          : "bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      Lista
                    </button>
                    <button
                      type="button"
                      onClick={() => setEpisodeLayout("compact")}
                      className={`h-9 px-3 rounded-lg border text-xs font-black whitespace-nowrap transition ${
                        episodeLayout === "compact"
                          ? "bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent-border)]"
                          : "bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      2 por fileira
                    </button>
                    <button
                      type="button"
                      onClick={() => setEpisodeLayout("default")}
                      className={`h-9 px-3 rounded-lg border text-xs font-black whitespace-nowrap transition ${
                        episodeLayout === "default"
                          ? "bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent-border)]"
                          : "bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      Atual
                    </button>
                  </div>
                </div>
              </div>

              {!hasEpisodeResults && (
                <p className="text-sm text-[var(--text-muted)] mb-6">
                  Nenhum episodio encontrado para esse filtro.
                </p>
              )}

              {seasons.map((season) => {
                const episodes = filteredEpisodesBySeason[season] || [];
                if (!episodes.length) return null;

                return (
                  <div key={season} className="mb-8">
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">
                      {seasons.length > 1 ? `Temporada ${season}` : "Episodios"}
                    </h3>

                    {episodeLayout === "list" ? (
                      <div className="space-y-2">
                        {episodes.map((ep) => (
                          <Link
                            prefetch={true}
                            key={ep.id}
                            href={`/watch/${ep.id}`}
                            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/40 hover:bg-white/[0.06] hover:border-[var(--border-strong)] px-3 py-2.5 transition"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-white text-sm truncate">
                                T{ep.season}E{ep.number} - {ep.title || `Episodio ${ep.number}`}
                              </p>
                              <p className="text-xs text-[var(--text-muted)] mt-0.5">{ep.duration || "--"}</p>
                            </div>
                            <Play size={14} className="text-[var(--text-accent)] shrink-0" />
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className={episodeLayout === "compact" ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"}>
                        {episodes.map((ep) => (
                          <div key={ep.id} className="glass-card border border-[var(--border-subtle)] hover:border-[var(--border-strong)] rounded-xl overflow-hidden group transition-all duration-300 flex flex-col hover:shadow-lg">
                            <Link prefetch={true} href={`/watch/${ep.id}`} className="block">
                              <div className={episodeLayout === "compact" ? "aspect-[16/10] bg-[var(--bg-card)] relative" : "aspect-video bg-[var(--bg-card)] relative"}>
                                <img src={ep.thumbnailUrl || anime.bannerImage || anime.coverImage || ""} className="w-full h-full object-cover opacity-50 group-hover:opacity-80 group-hover:scale-[1.03] transition-all duration-500" alt="" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className={`${episodeLayout === "compact" ? "w-9 h-9" : "w-10 h-10"} rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/90 group-hover:text-black transition-all duration-300 group-hover:scale-110`}>
                                    <Play size={episodeLayout === "compact" ? 16 : 18} className="text-white fill-white group-hover:text-black group-hover:fill-black ml-0.5" />
                                  </div>
                                </div>
                                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-lg border border-white/10">
                                  T{ep.season} E{ep.number}
                                </div>
                              </div>
                            </Link>
                            <div className="p-3 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-bold text-white text-sm truncate">{ep.title || `Episodio ${ep.number}`}</p>
                                <p className="text-xs text-[var(--text-muted)] mt-0.5">{ep.duration || "--"}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}


          {/* Comments */}
          <div id="anime-comments" className="scroll-mt-24">
              <h2 className="kdr-section-title text-xl mb-6 border-l-4 pl-4 rounded-r" style={{ borderColor: accentColor }}>
                <MessageSquare size={20} className="kdr-section-title-accent" /> ComentÃ¡rios ({comments.length})
              </h2>

            {session ? (
              <form onSubmit={handleComment} className="mb-8 space-y-2">
                {/* Emoji Bar */}
                <div className="flex items-center gap-1 flex-wrap">
                  {["ðŸ˜‚","â¤ï¸","ðŸ”¥","ðŸ‘","ðŸ˜­","ðŸ’€","ðŸ«¡","âœ¨","ðŸ˜®","ðŸŽ‰"].map(e => (
                    <button key={e} type="button" onClick={() => addEmoji(e)}
                      className="text-xl hover:scale-125 transition-transform duration-150 p-1 rounded-lg hover:bg-zinc-800 min-w-[36px]">
                      {e}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0">
                    <Image src={(session.user as any)?.avatarUrl || session.user?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user?.name || "U")}&background=111827&color=fff`} fill sizes="44px" className="object-cover" alt="avatar" />
                  </div>
                  <div className="flex-1 flex items-center gap-2 bg-[var(--bg-card)]/50 border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-xl px-4 py-2.5 transition focus-within:border-[var(--accent-border)]">
                    <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Deixe um comentÃ¡rio..."
                      className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder:text-[var(--text-muted)] min-w-0" />
                    <button type="submit" disabled={!newComment.trim()} className="text-[var(--text-accent)] hover:text-white disabled:opacity-30 transition">
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <p className="block text-center py-4 text-zinc-500 mb-6 text-sm">
                <Link prefetch={true} href="/login" className="kdr-section-title-accent hover:underline">FaÃ§a login</Link> para comentar
              </p>
            )}

            <div className="space-y-5">
              {comments.length === 0 ? (
                <p className="text-[var(--text-muted)] text-sm text-center py-8">Seja o primeiro a comentar!</p>
              ) : (
                comments.map(comment => (
                  <CommentItem key={comment.id} comment={comment} animeId={id} currentUserId={currentUserId} onRefresh={loadComments} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}


