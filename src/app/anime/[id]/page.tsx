"use client";

import AppLayout from "@/components/AppLayout";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { Play, ArrowLeft, Heart, MessageSquare, Send, CornerDownRight, Edit3, Trash2, Check, X, FolderOpen, ChevronDown, Star, Loader2, Clock3 } from "lucide-react";
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
  categories: { id: string; name: string }[];
  episodes: { id: string; title: string; number: number; season: number; duration?: string; videoUrl?: string; thumbnailUrl?: string }[];
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
    if (!confirm("Apagar comentário?")) return;
    await fetch("/api/comments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: comment.id }) });
    onRefresh();
  };

  const isOwn = currentUserId === comment.user.id;

  return (
    <div className="space-y-2">
      <div className="flex gap-3 group">
        <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0 mt-0.5">
          <Image src={comment.user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user.name)}&background=333&color=fff`} fill className="object-cover" alt={comment.user.name} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/profile/${comment.user.id}`} className="font-bold text-sm text-white hover:text-pink-500 transition">{comment.user.name}</Link>
            <span className="text-xs text-zinc-600">{new Date(comment.createdAt).toLocaleDateString("pt-BR")}</span>
            {comment.updatedAt !== comment.createdAt && <span className="text-xs text-zinc-600">(editado)</span>}
          </div>
          {editing ? (
            <div className="mt-1 flex items-start gap-2">
              <textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="flex-1 bg-zinc-900 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-pink-500 transition min-h-[60px]" />
              <div className="flex flex-col gap-1">
                <button onClick={handleEdit} className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition"><Check size={14} /></button>
                <button onClick={() => setEditing(false)} className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 transition"><X size={14} /></button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-300 mt-0.5 leading-relaxed">{comment.content}</p>
          )}
          <div className="flex items-center gap-3 mt-1">
            {currentUserId && (
              <button onClick={() => setReplyOpen(!replyOpen)} className="text-xs text-zinc-500 hover:text-pink-500 transition flex items-center gap-1">
                <CornerDownRight size={12} /> Responder
              </button>
            )}
            {isOwn && !editing && (
              <>
                <button onClick={() => setEditing(true)} className="text-xs text-zinc-500 hover:text-blue-400 transition flex items-center gap-1"><Edit3 size={12} /> Editar</button>
                <button onClick={handleDelete} className="text-xs text-zinc-500 hover:text-red-400 transition flex items-center gap-1"><Trash2 size={12} /> Apagar</button>
              </>
            )}
          </div>
          {replyOpen && (
            <div className="mt-2 flex items-start gap-2">
              <input value={replyContent} onChange={e => setReplyContent(e.target.value)} onKeyDown={e => e.key === "Enter" && handleReply()}
                placeholder="Sua resposta..." className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500 transition" />
              <button onClick={handleReply} className="p-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg transition"><Send size={14} /></button>
            </div>
          )}
        </div>
      </div>
      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-11 space-y-3 border-l-2 border-zinc-800 pl-4">
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


  const currentUserId = (session?.user as any)?.id;

  if (!anime) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  const seasons = Object.keys(groupedEps).map(Number).sort();

  return (
    <AppLayout>
      {/* Folder Picker Modal */}
      {showFolderPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowFolderPicker(false)} />
          <div className="relative bg-[#1a1a1a] border border-zinc-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2"><FolderOpen size={18} className="text-pink-500" /> Adicionar à Pasta</h3>
            <div className="relative">
              <select value={selectedFolder} onChange={e => setSelectedFolder(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-pink-500 transition appearance-none">
                <option value="">Sem pasta</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={confirmFavoriteWithFolder} className="flex-1 bg-pink-600 hover:bg-pink-500 text-white font-bold py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2">
                <Heart size={14} /> Favoritar
              </button>
              <button onClick={() => setShowFolderPicker(false)} className="px-4 py-2.5 bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-sm transition">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pb-24">
        {/* Banner */}
        <div className="relative w-full h-[45vh] lg:h-[55vh]">
          <img src={anime.bannerImage || anime.coverImage || ""} className="w-full h-full object-cover opacity-50" alt={anime.title} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#060606] via-[#060606]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#060606]/30 to-transparent" />
          <Link prefetch={true} href="/" className="absolute top-6 left-6 p-2.5 bg-zinc-900/80 hover:bg-pink-600 rounded-full text-white transition z-10 group shadow-lg">
            <ArrowLeft size={20} className="group-hover:-translate-x-0.5 transition" />
          </Link>
        </div>

        <div className="max-w-6xl mx-auto px-6 lg:px-10 -mt-28 relative z-10 space-y-10">
          {/* Info */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-36 md:w-44 shrink-0 rounded-2xl overflow-hidden shadow-2xl border-4 border-[#060606]">
              <img src={anime.coverImage || ""} alt={anime.title} className="w-full h-auto object-cover" />
            </div>
            <div className="pt-6 md:pt-12 flex-1">
                <div className="flex flex-wrap gap-2 mb-3">
                  {anime.categories.map(c => (
                    <span key={c.id} className="bg-pink-500/10 text-pink-400 border border-pink-500/20 px-3 py-0.5 rounded-full text-xs font-bold uppercase">{c.name}</span>
                  ))}
                  <span className={`px-3 py-0.5 rounded-full text-xs font-bold border ${anime.status === "completed" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>
                    {anime.status === "ongoing" ? "Em Andamento" : "Completo"}
                  </span>
                </div>
                <h1 className="text-3xl lg:text-5xl font-black text-white">{anime.title}</h1>
                <p className="mt-4 text-zinc-300 leading-relaxed max-w-2xl text-sm lg:text-base">{anime.description || "Nenhuma sinopse disponível."}</p>
                <div className="flex items-center gap-3 mt-6 flex-wrap">
                  {anime.episodes.length > 0 && (() => {
                    const lastWatchedEp = anime.episodes.find(e => e.id === lastWatchedEpId);
                    return (
                      <Link prefetch={true} href={`/watch/${lastWatchedEpId || anime.episodes[0]?.id}`}
                        className="flex items-center gap-2 bg-white text-black font-black px-6 py-2.5 rounded-xl hover:bg-pink-500 hover:text-white transition shadow-lg hover:shadow-[0_0_20px_rgba(255,0,127,0.4)] text-sm">
                        <Play fill="currentColor" size={16} /> {lastWatchedEp ? `Continuar Ep ${lastWatchedEp.number}` : "Assistir"}
                      </Link>
                    );
                  })()}
                  {session && (
                    <button onClick={handleFavorite}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition border ${isFavorited ? "bg-pink-500/20 border-pink-500 text-pink-400 hover:bg-pink-500/30" : "bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:border-pink-500 hover:text-pink-400"}`}>
                      <Heart size={16} className={isFavorited ? "fill-pink-400" : ""} />
                      {isFavorited ? "Minha Lista" : "P/ Lista"}
                    </button>
                  )}
                  {session && (
                    <button
                      onClick={handleWatchLater}
                      disabled={watchLaterLoading}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition border ${isWatchLater ? "bg-emerald-500/20 border-emerald-400 text-emerald-200" : "bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:border-emerald-400 hover:text-emerald-200"}`}
                    >
                      {watchLaterLoading ? <Loader2 size={16} className="animate-spin" /> : <Clock3 size={16} />}
                      {isWatchLater ? "Na fila (Assistir depois)" : "Assistir depois"}
                    </button>
                  )}
                </div>

              {/* ── Star Rating (Visible a todos; interação só logado) ── */}
              <div className="mt-8 pt-6 border-t border-white/5 w-full max-w-sm">
                <p className="text-sm font-bold text-zinc-400 mb-3 flex items-center gap-2">
                  <Star size={16} className="text-pink-500" />
                  {ratingData.total > 0
                    ? `Avaliação: ${ratingData.average?.toFixed(1) || "—"} / 5 (${ratingData.total} votos)`
                    : "Sem avaliações ainda"}
                </p>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = star <= (ratingHover || ratingData.userRating || 0);
                    return (
                      <button
                        key={star}
                        onClick={() => session && handleRate(star)}
                        onMouseEnter={() => session && setRatingHover(star)}
                        onMouseLeave={() => session && setRatingHover(0)}
                        disabled={!session}
                        className={`transition-transform p-1 ${session ? "hover:scale-110" : "opacity-50 cursor-not-allowed"}`}
                        title={session ? `Dar nota ${star}` : "Entre para avaliar"}
                      >
                        <Star
                          size={28}
                          className={`transition ${active
                            ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]"
                            : "text-zinc-600"}`}
                        />
                      </button>
                    );
                  })}
                  {ratingData.userRating && session && (
                    <span className="ml-3 text-xs font-bold text-pink-400 px-2 py-1 rounded bg-pink-500/10 border border-pink-500/20">
                      Sua nota: {ratingData.userRating}
                    </span>
                  )}
                </div>
                {!session && (
                  <p className="text-[11px] text-zinc-600 mt-2">Entre para avaliar este anime.</p>
                )}
              </div>
            </div>
          </div>

          {/* Episodes by Season */}
          {anime.episodes.length > 0 && (
            <div>
              <h2 className="text-xl font-black mb-6 border-l-4 border-pink-500 pl-4">Episódios</h2>
              {seasons.map(season => (
                <div key={season} className="mb-8">
                  <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">
                    {seasons.length > 1 ? `Temporada ${season}` : "Episódios"}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {(groupedEps[season] as Anime["episodes"] || []).map(ep => (
                      <div key={ep.id} className="bg-zinc-900/50 border border-zinc-800 hover:border-pink-500 rounded-xl overflow-hidden group transition flex flex-col">
                        <Link prefetch={true} href={`/watch/${ep.id}`} className="block">
                          <div className="aspect-video bg-zinc-800 relative">
                            <img src={ep.thumbnailUrl || anime.bannerImage || anime.coverImage || ""} className="w-full h-full object-cover opacity-40 group-hover:opacity-70 transition" alt="" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-pink-500/80 transition">
                                <Play size={18} className="text-white fill-white" />
                              </div>
                            </div>
                            <div className="absolute top-2 left-2 bg-black/60 text-pink-400 text-xs font-bold px-2 py-0.5 rounded-full">
                              T{ep.season} E{ep.number}
                            </div>
                          </div>
                        </Link>
                        <div className="p-3 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-white text-sm truncate">{ep.title || `Episódio ${ep.number}`}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">{ep.duration || "—"}</p>
                          </div>
                          {/* Download button */}
                          <a
                            href={ep.videoUrl}
                            download={`${anime.title} - T${ep.season}E${ep.number}.mp4`}
                            title="Baixar episódio (MP4)"
                            onClick={e => e.stopPropagation()}
                            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-green-600 text-zinc-400 hover:text-white transition"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                              <polyline points="7 10 12 15 17 10"/>
                              <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}


          {/* Comments */}
          <div>
            <h2 className="text-xl font-black mb-6 border-l-4 border-pink-500 pl-4 flex items-center gap-2">
              <MessageSquare size={20} className="text-pink-500" /> Comentários ({comments.length})
            </h2>

            {session ? (
              <form onSubmit={handleComment} className="mb-8 space-y-2">
                {/* Emoji Bar */}
                <div className="flex items-center gap-1 flex-wrap">
                  {["😂","❤️","🔥","👍","😭","💀","🫡","✨","😮","🎉"].map(e => (
                    <button key={e} type="button" onClick={() => addEmoji(e)}
                      className="text-xl hover:scale-125 transition-transform duration-150 p-1 rounded-lg hover:bg-zinc-800 min-w-[36px]">
                      {e}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0">
                    <Image src={(session.user as any)?.avatarUrl || session.user?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user?.name || "U")}&background=ff007f&color=fff`} fill className="object-cover" alt="avatar" />
                  </div>
                  <div className="flex-1 flex items-center gap-2 bg-zinc-900/70 border border-zinc-700 hover:border-zinc-500 rounded-xl px-4 py-2.5 transition focus-within:border-pink-500">
                    <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Deixe um comentário..."
                      className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder:text-zinc-600 min-w-0" />
                    <button type="submit" disabled={!newComment.trim()} className="text-pink-500 hover:text-pink-400 disabled:opacity-30 transition">
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <Link prefetch={true} href="/login" className="block text-center py-4 text-zinc-500 hover:text-pink-500 transition mb-6 text-sm">
                <Link prefetch={true} href="/login" className="text-pink-500 hover:underline">Faça login</Link> para comentar
              </Link>
            )}

            <div className="space-y-5">
              {comments.length === 0 ? (
                <p className="text-zinc-600 text-sm text-center py-8">Seja o primeiro a comentar!</p>
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
