"use client";

import AppLayout from "@/components/AppLayout";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { UserCircle, Users, Heart, Edit3, Check, UploadCloud, Lock, Film, Key, X, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

interface ProfileUser {
  id: string; name: string; avatarUrl?: string; bannerUrl?: string; bio?: string;
  _count: { followers: number; following: number };
  favorites: { animeId: string; anime: { id: string; title: string; coverImage?: string }; folder?: { id: string; name: string; isPrivate: boolean } }[];
  favoriteFolders: { id: string; name: string; isPrivate: boolean }[];
  histories: { episode: { title?: string; number?: number; season?: number; anime: { id: string; title: string; coverImage?: string } } }[];
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

export default function ProfilePage() {
  const { data: session } = useSession();
  const params = useParams();
  const userId = (params?.id as string) || "";

  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [followData, setFollowData] = useState({ isFollowing: false, followersCount: 0, followingCount: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", bio: "", avatarUrl: "", bannerUrl: "" });
  const [saving, setSaving] = useState(false);

  // Password change state
  const [showPwForm, setShowPwForm] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const isOwnProfile = !userId || (session?.user as any)?.id === userId;
  const targetId = isOwnProfile ? (session?.user as any)?.id : userId;

  useEffect(() => {
    if (!targetId) return;
    fetch(`/api/profile?id=${targetId}`).then(r => r.json()).then(setProfile);
    fetch(`/api/follows?userId=${targetId}`).then(r => r.json()).then(setFollowData);
  }, [targetId]);

  useEffect(() => {
    if (profile) setEditForm({ name: profile.name, bio: profile.bio || "", avatarUrl: profile.avatarUrl || "", bannerUrl: profile.bannerUrl || "" });
  }, [profile]);

  const handleFollow = async () => {
    await fetch("/api/follows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ followingId: targetId }) });
    fetch(`/api/follows?userId=${targetId}`).then(r => r.json()).then(setFollowData);
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) });
    fetch(`/api/profile?id=${targetId}`).then(r => r.json()).then(setProfile);
    setSaving(false); setIsEditing(false);
  };

  const handlePasswordChange = async () => {
    setPwError("");
    if (pwForm.newPw !== pwForm.confirm) { setPwError("As senhas não coincidem."); return; }
    if (pwForm.newPw.length < 6) { setPwError("Nova senha deve ter mínimo 6 caracteres."); return; }
    const res = await fetch("/api/profile/change-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.newPw }),
    });
    if (res.ok) {
      setPwSuccess(true); setPwForm({ current: "", newPw: "", confirm: "" }); setShowPwForm(false);
      setTimeout(() => setPwSuccess(false), 3000);
    } else {
      const d = await res.json(); setPwError(d.error || "Erro ao alterar senha.");
    }
  };

  if (!profile) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  const publicFolders = profile.favoriteFolders.filter(f => !f.isPrivate || isOwnProfile);

  return (
    <AppLayout>
      <div className="pb-24">
        {/* Banner */}
        <div className="relative w-full h-48 lg:h-64">
          <div className={`absolute inset-0 ${profile.bannerUrl ? "" : "bg-gradient-to-br from-pink-900/50 via-zinc-900 to-purple-900/30"}`}>
            {profile.bannerUrl && <img src={profile.bannerUrl} className="w-full h-full object-cover" alt="Banner" />}
            <div className="absolute inset-0 bg-gradient-to-t from-[#060606] to-transparent" />
          </div>
          {isOwnProfile && isEditing && (
            <label className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 hover:bg-black/80 text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer transition">
              <UploadCloud size={14} /> Mudar Banner
              <input type="file" accept="image/*" className="hidden" onChange={async e => {
                const f = e.target.files?.[0]; if (!f) return;
                const fd = new FormData(); fd.append("file", f); fd.append("folder", "uploads");
                const r = await fetch("/api/upload", { method: "POST", body: fd });
                const d = await r.json(); if (d.url) setEditForm(ef => ({ ...ef, bannerUrl: d.url }));
              }} />
            </label>
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
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-pink-600 hover:bg-pink-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition">
                      <Check size={14} /> {saving ? "Salvando..." : "Salvar"}
                    </button>
                    <button onClick={() => setShowPwForm(!showPwForm)} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-4 py-2 rounded-lg text-sm transition">
                      <Key size={14} /> Mudar Senha
                    </button>
                    <button onClick={() => { setIsEditing(false); setShowPwForm(false); }} className="px-4 py-2 bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-sm transition">Cancelar</button>
                  </div>

                  {/* Password change form */}
                  {showPwForm && (
                    <div className="bg-zinc-900/80 border border-zinc-700 rounded-xl p-4 space-y-3 mt-2">
                      <p className="font-bold text-sm text-white">Alterar Senha</p>
                      {pwError && <p className="text-red-400 text-xs font-bold">{pwError}</p>}
                      <input type="password" placeholder="Senha atual" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-pink-500 transition" />
                      <div className="relative">
                        <input type={showPw ? "text" : "password"} placeholder="Nova senha" value={pwForm.newPw} onChange={e => setPwForm(p => ({ ...p, newPw: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-pink-500 transition pr-10" />
                        <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                      </div>
                      <input type="password" placeholder="Confirmar nova senha" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-pink-500 transition" />
                      <button onClick={handlePasswordChange} className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold py-2.5 rounded-lg text-sm transition">
                        Confirmar Alteração
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {pwSuccess && <p className="text-green-400 text-xs font-bold mb-2 animate-fadeIn">✅ Senha alterada com sucesso!</p>}
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl font-black text-white">{profile.name}</h1>
                    {isOwnProfile && (
                      <button onClick={() => setIsEditing(true)} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition">
                        <Edit3 size={16} />
                      </button>
                    )}
                    {!isOwnProfile && session && (
                      <button onClick={handleFollow}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold transition ${followData.isFollowing ? "bg-zinc-800 text-zinc-300 hover:bg-red-500/20 hover:text-red-400" : "bg-pink-600 text-white hover:bg-pink-500"}`}>
                        {followData.isFollowing ? "Seguindo" : "+ Seguir"}
                      </button>
                    )}
                  </div>
                  {profile.bio && <p className="text-zinc-400 text-sm mt-2 max-w-lg">{profile.bio}</p>}
                  <div className="flex gap-5 mt-3">
                    <div className="text-center"><p className="font-black text-white text-lg">{followData.followersCount}</p><p className="text-xs text-zinc-500">Seguidores</p></div>
                    <div className="text-center"><p className="font-black text-white text-lg">{followData.followingCount}</p><p className="text-xs text-zinc-500">Seguindo</p></div>
                    <div className="text-center"><p className="font-black text-white text-lg">{profile.favorites.length}</p><p className="text-xs text-zinc-500">Favoritos</p></div>
                  </div>
                </>
              )}
            </div>
          </div>

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
          {publicFolders.length > 0 && (
            <div className="mt-8">
              <h2 className="font-bold text-sm text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Heart size={14} className="text-pink-500" /> Favoritos</h2>
              <div className="space-y-5">
                {publicFolders.map(folder => {
                  const folderFavs = profile.favorites.filter(f => f.folder?.id === folder.id);
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
        </div>
      </div>
    </AppLayout>
  );
}
