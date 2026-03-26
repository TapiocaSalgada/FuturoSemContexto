"use client";

import AppLayout from "@/components/AppLayout";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { Heart, Edit3, Check, UploadCloud, Lock, Film, Trophy } from "lucide-react";
import Link from "next/link";

interface ProfileUser {
  id: string; name: string; avatarUrl?: string; bannerUrl?: string; bio?: string; isPrivate: boolean;
  canFollow?: boolean;
  _count: { followers: number; following: number };
  favorites?: { animeId: string; anime: { id: string; title: string; coverImage?: string }; folder?: { id: string; name: string; isPrivate: boolean } }[];
  favoriteFolders?: { id: string; name: string; isPrivate: boolean }[];
  histories?: { episode: { title?: string; number?: number; season?: number; anime: { id: string; title: string; coverImage?: string } } }[];
}

function UploadBtn({ onUpload }: { onUpload: (url: string) => void }) {
  const [loading, setLoading] = useState(false);
  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setLoading(true);
    const fd = new FormData(); fd.append("file", f); fd.append("folder", "uploads");
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await r.json(); if (d.url) onUpload(d.url);
    setLoading(false);
  };
  return (
    <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition cursor-pointer rounded-full">
      {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <UploadCloud size={18} className="text-white" />}
      <input type="file" accept="image/*" className="hidden" onChange={handle} disabled={loading} />
    </label>
  );
}

function BannerUpload({ onUpload }: { onUpload: (url: string) => void }) {
  const [loading, setLoading] = useState(false);
  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setLoading(true);
    const fd = new FormData(); fd.append("file", f); fd.append("folder", "uploads");
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await r.json(); if (d.url) onUpload(d.url);
    setLoading(false);
  };
  return (
    <label className="absolute inset-0 flex items-center justify-center cursor-pointer z-10">
      <div className="flex flex-col items-center gap-2 bg-black/70 hover:bg-black/85 active:bg-black/95 transition rounded-2xl px-6 py-4 border border-white/20 backdrop-blur-sm select-none">
        {loading
          ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : <UploadCloud size={28} className="text-white" />
        }
        <span className="text-white font-bold text-sm">{loading ? "Enviando..." : "Mudar Banner"}</span>
        <span className="text-zinc-400 text-xs">Toque aqui para trocar</span>
      </div>
      <input type="file" accept="image/*" className="hidden" onChange={handle} disabled={loading} />
    </label>
  );
}


export default function ProfilePage() {
  const { data: session } = useSession();
  const params = useParams();
  const userId = (params?.id as string) || "";

  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [followData, setFollowData] = useState({ isFollowing: false, followersCount: 0, followingCount: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", bio: "", avatarUrl: "", bannerUrl: "", isPrivate: false });
  const [saving, setSaving] = useState(false);

  // Modal followers setup
  const [showFollowUsers, setShowFollowUsers] = useState<"followers" | "following" | null>(null);
  const [followList, setFollowList] = useState<{id: string, name: string, avatarUrl: string}[]>([]);

  // Achievements
  const [achievements, setAchievements] = useState<{achievementId: string; showOnProfile: boolean; earnedAt: string; def: {label: string; emoji: string; description: string; category: string}}[]>([]);

  const isOwnProfile = !userId || (session?.user as any)?.id === userId;
  const targetId = isOwnProfile ? (session?.user as any)?.id : userId;

  useEffect(() => {
    if (!targetId) return;
    fetch(`/api/profile?id=${targetId}`).then(r => r.json()).then(setProfile);
    fetch(`/api/follows?userId=${targetId}`).then(r => r.json()).then(setFollowData);
    fetch(`/api/achievements?userId=${targetId}`).then(r => r.json()).then(setAchievements);
  }, [targetId]);

  useEffect(() => {
    if (profile) setEditForm({ name: profile.name, bio: profile.bio || "", avatarUrl: profile.avatarUrl || "", bannerUrl: profile.bannerUrl || "", isPrivate: profile.isPrivate });
  }, [profile]);

  const handleFollow = async () => {
    // Optimistic update
    setFollowData(prev => ({
      ...prev,
      isFollowing: !prev.isFollowing,
      followersCount: prev.isFollowing ? prev.followersCount - 1 : prev.followersCount + 1,
    }));
    await fetch("/api/follows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetId }) });
    // Sync real state after
    fetch(`/api/follows?userId=${targetId}`).then(r => r.json()).then(setFollowData);
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) });
    setProfile(p => p ? { ...p, ...editForm } : null);
    setIsEditing(false);
    setSaving(false);
  };

  const loadFollowers = async (type: "followers" | "following") => {
    const r = await fetch(`/api/follows/list?userId=${targetId}&type=${type}`);
    const d = await r.json();
    setFollowList(d);
    setShowFollowUsers(type);
  };

  if (!profile) {
    if (isOwnProfile && session?.user) {
      return (
        <AppLayout>
          <div className="pb-24">
            <div className="relative w-full h-56 lg:h-80 bg-zinc-900 animate-pulse">
              <div className="absolute inset-0 bg-gradient-to-t from-[#060606] to-transparent" />
            </div>
            <div className="max-w-4xl mx-auto px-6 lg:px-10 -mt-16 relative z-10">
              <div className="flex flex-col sm:flex-row items-start gap-6">
                <div className="relative group shrink-0">
                  <div className="w-28 h-28 rounded-full border-4 border-[#060606] overflow-hidden bg-zinc-800 shadow-2xl">
                    <img src={session.user.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user.name || "U")}&background=ff007f&color=fff`} className="w-full h-full object-cover" alt="" />
                  </div>
                </div>
                <div className="flex-1 pt-4">
                  <h1 className="text-2xl font-black text-white">{session.user.name}</h1>
                  <div className="w-48 h-4 bg-zinc-800 rounded animate-pulse mt-4" />
                  <div className="w-32 h-4 bg-zinc-800 rounded animate-pulse mt-2" />
                </div>
              </div>
              <div className="mt-8 flex items-center justify-center h-40">
                <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          </div>
        </AppLayout>
      );
    }
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const publicFolders = profile.favoriteFolders?.filter(f => !f.isPrivate || isOwnProfile) || [];
  const looseFavorites = profile.favorites?.filter(f => !f.folder) || [];

  return (
    <AppLayout>
      <div className="pb-24">
        {/* Banner */}
        <div className="relative w-full h-56 lg:h-80">
          <div className={`absolute inset-0 ${profile.bannerUrl ? "" : "bg-gradient-to-br from-pink-900/50 via-zinc-900 to-purple-900/30"}`}>
            {profile.bannerUrl && <img src={profile.bannerUrl} className="w-full h-full object-cover" alt="Banner" />}
            <div className="absolute inset-0 bg-gradient-to-t from-[#060606] to-transparent" />
          </div>
          {isOwnProfile && isEditing && (
            <BannerUpload onUpload={url => setEditForm(ef => ({ ...ef, bannerUrl: url }))} />
          )}
        </div>

        <div className="max-w-4xl mx-auto px-6 lg:px-10 -mt-16 relative z-10">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <div className="w-28 h-28 rounded-full border-4 border-[#060606] overflow-hidden bg-zinc-800 shadow-2xl">
                <img src={isEditing && editForm.avatarUrl ? editForm.avatarUrl : (profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=ff007f&color=fff`)} className="w-full h-full object-cover" alt={profile.name} />
              </div>
              {isOwnProfile && isEditing && <UploadBtn onUpload={url => setEditForm(ef => ({ ...ef, avatarUrl: url }))} />}
            </div>

            {/* Info */}
            <div className="flex-1 pt-4">
              {isEditing ? (
                <div className="space-y-3">
                  <input value={editForm.name} onChange={e => setEditForm(ef => ({ ...ef, name: e.target.value }))} className="text-2xl font-black bg-transparent border-b border-pink-500 text-white focus:outline-none w-full pb-1" />
                  <textarea value={editForm.bio} onChange={e => setEditForm(ef => ({ ...ef, bio: e.target.value }))} placeholder="Sua bio..." className="w-full bg-zinc-900/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500 transition min-h-[80px] resize-none" />
                  
                  <label className="flex items-center gap-2 mt-2 cursor-pointer pb-2">
                    <input type="checkbox" checked={editForm.isPrivate} onChange={e => setEditForm(ef => ({ ...ef, isPrivate: e.target.checked }))} className="w-4 h-4 text-pink-500 bg-zinc-900 border-zinc-700 rounded focus:ring-pink-500 accent-pink-500" />
                    <span className="text-sm font-bold text-zinc-300 select-none">Perfil Privado (Ocultar histórico e favoritos)</span>
                  </label>

                  <div className="flex gap-2 flex-wrap">
                    <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-pink-600 hover:bg-pink-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition">
                      <Check size={14} /> {saving ? "Salvando..." : "Salvar"}
                    </button>
                    <Link href="/settings" className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-4 py-2 rounded-lg text-sm transition">
                      Configurações
                    </Link>
                    <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-sm transition">Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl font-black text-white">{profile.name}</h1>
                    {isOwnProfile && (
                      <button onClick={() => setIsEditing(true)} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition">
                        <Edit3 size={16} />
                      </button>
                    )}
                    {!isOwnProfile && session && profile.canFollow !== false && (
                      <button onClick={handleFollow}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold transition ${followData.isFollowing ? "bg-zinc-800 text-zinc-300 hover:bg-red-500/20 hover:text-red-400" : "bg-pink-600 text-white hover:bg-pink-500"}`}>
                        {followData.isFollowing ? "Seguindo" : "+ Seguir"}
                      </button>
                    )}
                    {!isOwnProfile && profile.canFollow === false && (
                      <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 text-xs font-bold">
                        Seguidores desativados
                      </span>
                    )}
                  </div>
                  {profile.bio && <p className="text-zinc-400 text-sm mt-2 max-w-lg">{profile.bio}</p>}
                  <div className="flex gap-5 mt-3">
                    <div onClick={() => loadFollowers("followers")} className="text-center cursor-pointer hover:bg-white/5 rounded-lg p-1 transition"><p className="font-black text-white text-lg">{followData.followersCount}</p><p className="text-xs text-zinc-500 hover:text-pink-400">Seguidores</p></div>
                    <div onClick={() => loadFollowers("following")} className="text-center cursor-pointer hover:bg-white/5 rounded-lg p-1 transition"><p className="font-black text-white text-lg">{followData.followingCount}</p><p className="text-xs text-zinc-500 hover:text-pink-400">Seguindo</p></div>
                    <div className="text-center p-1"><p className="font-black text-white text-lg">{profile.favorites?.length || 0}</p><p className="text-xs text-zinc-500">Favoritos</p></div>
                  </div>
                </>
              )}
            </div>
          </div>

          {!isOwnProfile && profile.isPrivate ? (
            <div className="mt-12 text-center p-10 bg-zinc-900/50 rounded-2xl border border-zinc-800">
              <Lock className="mx-auto mb-3 text-zinc-500" size={32} />
              <h3 className="text-white font-bold mb-1 text-lg">Perfil Privado</h3>
              <p className="text-sm text-zinc-400">Este usuário optou por manter seu histórico e favoritos privados.</p>
            </div>
          ) : (
            <>
              {/* Watch History */}
              {profile.histories && profile.histories.length > 0 && (
            <div className="mt-8">
              <h2 className="font-bold text-sm text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Film size={14} /> Histórico Recente</h2>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                {profile.histories.slice(0, 10).map((h, i) => {
                  const anime = h.episode?.anime;
                  if (!anime) return null;
                  return (
                    <Link key={i} href={`/anime/${anime.id}`} className="w-20 shrink-0 group">
                      <div className="aspect-[2/3] rounded-lg overflow-hidden border border-zinc-800 group-hover:border-pink-500 transition">
                        <img src={anime.coverImage || ""} alt={anime.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                      </div>
                      <p className="text-xs text-zinc-500 group-hover:text-white transition mt-1 truncate text-center">{anime.title}</p>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Favorite Folders */}
          {(looseFavorites.length > 0 || publicFolders.length > 0) && (
            <div className="mt-8">
              <h2 className="font-bold text-sm text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Heart size={14} className="text-pink-500" /> Favoritos</h2>
              <div className="space-y-5">
                {looseFavorites.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-bold text-white text-sm">Sem pasta</span>
                      <span className="text-xs text-zinc-500">({looseFavorites.length})</span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                      {looseFavorites.map(fav => (
                        <Link key={fav.animeId} href={`/anime/${fav.anime.id}`} className="w-20 shrink-0 group">
                          <div className="aspect-[2/3] rounded-lg overflow-hidden border border-zinc-800 group-hover:border-pink-500 transition">
                            <img src={fav.anime.coverImage || ""} alt={fav.anime.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                          </div>
                          <p className="text-xs text-zinc-500 group-hover:text-white transition mt-1 truncate text-center">{fav.anime.title}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {publicFolders.map(folder => {
                  const folderFavs = profile.favorites?.filter(f => f.folder?.id === folder.id) || [];
                  return (
                    <div key={folder.id}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="font-bold text-white text-sm">{folder.name}</span>
                        {folder.isPrivate && <Lock size={11} className="text-zinc-500" />}
                        <span className="text-xs text-zinc-500">({folderFavs.length})</span>
                      </div>
                      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                        {folderFavs.length === 0
                          ? <p className="text-zinc-600 text-xs">Pasta vazia.</p>
                          : folderFavs.map(fav => (
                            <Link key={fav.animeId} href={`/anime/${fav.anime.id}`} className="w-20 shrink-0 group">
                              <div className="aspect-[2/3] rounded-lg overflow-hidden border border-zinc-800 group-hover:border-pink-500 transition">
                                <img src={fav.anime.coverImage || ""} alt={fav.anime.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                              </div>
                              <p className="text-xs text-zinc-500 group-hover:text-white transition mt-1 truncate text-center">{fav.anime.title}</p>
                            </Link>
                          ))
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </>)}
        </div>
      </div>

      {/* Followers Modal */}
      {showFollowUsers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowFollowUsers(null)} />
          <div className="relative bg-[#1a1a1a] border border-zinc-700 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-lg mb-4 text-white">
              {showFollowUsers === "followers" ? "Seguidores" : "Seguindo"}
            </h3>
            <div className="max-h-64 overflow-y-auto space-y-3">
              {followList.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">Nenhum usuário encontrado.</p>
              ) : (
                followList.map(u => (
                  <Link key={u.id} href={`/profile/${u.id}`} onClick={() => setShowFollowUsers(null)} className="flex items-center gap-3 p-2 hover:bg-zinc-800 rounded-lg transition group">
                    <img src={u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=ff007f&color=fff`} className="w-10 h-10 rounded-full object-cover" alt="" />
                    <p className="text-sm font-bold text-zinc-300 group-hover:text-white transition">{u.name}</p>
                  </Link>
                ))
              )}
            </div>
            <button onClick={() => setShowFollowUsers(null)} className="mt-4 w-full bg-zinc-800 text-zinc-300 hover:text-white font-bold py-2.5 rounded-lg text-sm transition">
              Fechar
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
