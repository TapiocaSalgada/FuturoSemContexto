"use client";

import AppLayout from "@/components/AppLayout";
import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Heart, Edit3, Check, UploadCloud, Lock, Film, Trophy, X, Users, Play } from "lucide-react";
import Link from "next/link";
import AnimeCard from "@/components/AnimeCard";
import Image from "next/image";

interface ProfileUser {
  id: string; name: string; avatarUrl?: string; bannerUrl?: string; bio?: string; isPrivate: boolean;
  canFollow?: boolean;
  isOnline?: boolean;
  lastActiveAt?: string | null;
  _count: { followers: number; following: number };
  favorites?: { animeId: string; anime: { id: string; title: string; coverImage?: string; visibility?: string }; folder?: { id: string; name: string; isPrivate: boolean } }[];
  favoriteFolders?: { id: string; name: string; isPrivate: boolean }[];
  histories?: { episode: { title?: string; number?: number; season?: number; anime: { id: string; title: string; coverImage?: string; visibility?: string } } }[];
}

type ProfileTab = "atividade" | "posts" | "animes" | "mangas" | "favoritos";

const PROFILE_TABS: { key: ProfileTab; label: string }[] = [
  { key: "atividade", label: "Atividade" },
  { key: "posts", label: "Comentários" },
  { key: "animes", label: "Animes" },
  { key: "mangas", label: "Mangas" },
  { key: "favoritos", label: "Favoritos" },
];

function formatLastSeen(lastActiveAt?: string | null): string {
  if (!lastActiveAt) return "Nunca online";
  const diffMs = Date.now() - new Date(lastActiveAt).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return "Online agora";

  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Online agora";
  if (diffMin < 60) return `Visto há ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Visto há ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  return `Visto há ${diffDays} dia${diffDays > 1 ? "s" : ""}`;
}

const PROFESSIONAL_AVATARS = [
  "https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=111827",
  "https://api.dicebear.com/7.x/notionists/svg?seed=Aidan&backgroundColor=333333",
  "https://api.dicebear.com/7.x/notionists/svg?seed=Aneka&backgroundColor=334155",
  "https://api.dicebear.com/7.x/notionists/svg?seed=Brooklynn&backgroundColor=111827",
  "https://api.dicebear.com/7.x/notionists/svg?seed=Jude&backgroundColor=333333",
  "https://api.dicebear.com/7.x/notionists/svg?seed=Ryan&backgroundColor=334155",
  "https://api.dicebear.com/7.x/notionists/svg?seed=Sara&backgroundColor=111827",
  "https://api.dicebear.com/7.x/notionists/svg?seed=Destiny&backgroundColor=333333",
  "https://api.dicebear.com/7.x/notionists/svg?seed=Emery&backgroundColor=334155",
  "https://api.dicebear.com/7.x/notionists/svg?seed=Mia&backgroundColor=111827",
];

function AvatarPickerModal({ onClose, onSelect, currentUrl }: { onClose: () => void, onSelect: (url: string) => void, currentUrl: string }) {
  const [loadingImg, setLoadingImg] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setLoadingImg("upload");
    const fd = new FormData(); fd.append("file", f); fd.append("folder", "uploads");
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await r.json(); if (d.url) { onSelect(d.url); onClose(); }
    setLoadingImg(null);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-surface-heavy border border-white/12 rounded-3xl p-6 w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh] animate-fadeInUp">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-black text-xl text-white">Escolha um Avatar</h3>
          <button onClick={onClose} className="p-2 bg-[var(--bg-card)] rounded-full text-[var(--text-muted)] hover:text-white transition"><X size={16} /></button>
        </div>
        
        <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-white/15 hover:border-white/35 bg-black/25 hover:bg-white/5 transition cursor-pointer mb-6 group">
          {loadingImg === "upload" ? (
             <div className="kdr-spinner" />
          ) : (
            <>
              <UploadCloud size={24} className="text-[var(--text-muted)] group-hover:text-white transition" />
              <span className="text-sm font-bold text-[var(--text-secondary)] group-hover:text-white">Fazer Upload de Foto</span>
            </>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={loadingImg === "upload"} />
        </label>

        <div className="overflow-y-auto pr-2 scrollbar-hide">
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3">Ou escolha um pronto:</p>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
            {PROFESSIONAL_AVATARS.map(url => (
               <button key={url} onClick={() => { onSelect(url); onClose(); }} className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition ${currentUrl === url ? "border-white/60 scale-105" : "border-transparent hover:border-zinc-500 opacity-70 hover:opacity-100"}`} style={currentUrl === url ? { boxShadow: "0 0 15px color-mix(in srgb, var(--accent) 35%, transparent)" } : undefined}>
                 <Image src={url} alt="" fill sizes="(max-width: 640px) 22vw, 96px" className="object-cover" />
               </button>
            ))}
          </div>
        </div>
      </div>
    </div>
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
        <span className="text-[var(--text-muted)] text-xs">Toque aqui para trocar</span>
      </div>
      <input type="file" accept="image/*" className="hidden" onChange={handle} disabled={loading} />
    </label>
  );
}


export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userId = (params?.id as string) || "";

  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [followData, setFollowData] = useState({ isFollowing: false, followersCount: 0, followingCount: 0, friendsCount: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", bio: "", avatarUrl: "", bannerUrl: "", isPrivate: false });
  const [saving, setSaving] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(true);

  // Modal followers setup
  const [showFollowUsers, setShowFollowUsers] = useState<"followers" | "following" | "friends" | null>(null);
  const [followList, setFollowList] = useState<{id: string, name: string, avatarUrl: string}[]>([]);

  // Achievements
  const [achievements, setAchievements] = useState<{achievementId: string; showOnProfile: boolean; earnedAt: string; def: {label: string; emoji: string; description: string; category: string}}[]>([]);

  const isOwnProfile = !userId || (session?.user as any)?.id === userId;
  const targetId = isOwnProfile ? (session?.user as any)?.id : userId;

  const activeTab = useMemo<ProfileTab>(() => {
    const tab = String(searchParams?.get("tab") || "").toLowerCase();
    if (tab === "posts" || tab === "animes" || tab === "mangas" || tab === "favoritos") {
      return tab;
    }
    return "atividade";
  }, [searchParams]);

  const handleTabChange = (tab: ProfileTab) => {
    const paramsCopy = new URLSearchParams(searchParams?.toString() || "");
    if (tab === "atividade") {
      paramsCopy.delete("tab");
    } else {
      paramsCopy.set("tab", tab);
    }

    const query = paramsCopy.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

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
    if (isOwnProfile && editForm.avatarUrl !== session?.user?.image) {
      await updateSession({ image: editForm.avatarUrl });
    }
    setIsEditing(false);
    setSaving(false);
  };

  const loadFollowers = async (type: "followers" | "following" | "friends") => {
    try {
      const r = await fetch(`/api/follows/list?userId=${targetId}&type=${type}`);
      if (!r.ok) throw new Error("Erro ao carregar");
      const d = await r.json();
      setFollowList(Array.isArray(d) ? d : []);
    } catch (err) {
      console.error("Followers modal error", err);
      setFollowList([]);
    } finally {
      setShowFollowUsers(type);
    }
  };

  if (!profile) {
    if (isOwnProfile && session?.user) {
      return (
        <AppLayout>
          <div className="pb-24">
            <div className="relative w-full h-56 lg:h-80 kdr-skeleton">
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] to-transparent" />
            </div>
            <div className="max-w-4xl mx-auto px-6 lg:px-10 -mt-16 relative z-10">
              <div className="flex flex-col sm:flex-row items-start gap-6">
                <div className="relative group shrink-0">
                  <div className="w-28 h-28 rounded-full border-4 border-[var(--background)] overflow-hidden bg-[var(--bg-card)] shadow-2xl relative">
                    <Image src={session.user.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user.name || "U")}&background=111827&color=fff`} fill sizes="128px" className="object-cover" alt="" unoptimized={session.user.image?.startsWith('http') ? false : true} />
                  </div>
                </div>
                <div className="flex-1 pt-4">
                  <h1 className="text-2xl font-black text-white">{session.user.name}</h1>
                  <div className="w-48 h-4 kdr-skeleton rounded mt-4" />
                  <div className="w-32 h-4 kdr-skeleton rounded mt-2" />
                </div>
              </div>
              <div className="mt-8 flex items-center justify-center h-40">
                <div className="kdr-spinner" />
              </div>
            </div>
          </div>
        </AppLayout>
      );
    }
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <div className="kdr-spinner" />
          <p className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest">Carregando perfil...</p>
        </div>
      </AppLayout>
    );
  }

  const publicFolders = profile.favoriteFolders?.filter(f => !f.isPrivate || isOwnProfile) || [];
  const looseFavorites = profile.favorites?.filter(f => !f.folder && (!f.anime.visibility || f.anime.visibility === "public")) || [];
  const profileStats = [
    { label: "Animes", value: profile.favorites?.length || 0, icon: Heart },
    { label: "Episodios", value: profile.histories?.length || 0, icon: Play },
    { label: "Seguidores", value: followData.followersCount, icon: Users },
    { label: "Amigos", value: followData.friendsCount, icon: Trophy },
  ];
  const timelineItems = (profile.histories || [])
    .filter((entry) => !entry.episode?.anime?.visibility || entry.episode.anime.visibility === "public")
    .slice(0, 6)
    .map((entry, idx) => {
      const anime = entry.episode?.anime;
      if (!anime) return null;
      return {
        id: `${anime.id}-${entry.episode.number || idx}`,
        animeId: anime.id,
        animeTitle: anime.title,
        episodeNumber: entry.episode.number,
        accentTime: idx === 0 ? "Agora" : idx === 1 ? "2 horas atras" : `${idx + 1} dias atras`,
      };
    })
    .filter(Boolean) as { id: string; animeId: string; animeTitle: string; episodeNumber?: number; accentTime: string }[];

  const isPrivateForViewer = !isOwnProfile && profile.isPrivate;
  const showTimeline = !isEditing && activeTab === "atividade" && timelineItems.length > 0;
  const showHistorySection =
    !isPrivateForViewer &&
    (activeTab === "atividade" || activeTab === "animes");
  const showFavoritesSection =
    !isPrivateForViewer &&
    (activeTab === "atividade" || activeTab === "animes" || activeTab === "favoritos");
  const showPostsPlaceholder = !isPrivateForViewer && activeTab === "posts";
  const showMangasPlaceholder = !isPrivateForViewer && activeTab === "mangas";

  return (
    <AppLayout>
      <div className="pb-28 md:pb-24">
        {/* Banner */}
        <div className="relative w-full h-[36vh] sm:h-[44vh] lg:h-[52vh] overflow-hidden rounded-none lg:rounded-[30px] border-0 lg:border lg:border-[var(--border-subtle)]">
          <div className={`absolute inset-0 ${profile.bannerUrl ? "" : "bg-gradient-to-br from-black/55 via-[var(--bg-card)] to-slate-900/40"}`}>
            {profile.bannerUrl && <img src={profile.bannerUrl} className="w-full h-full object-cover [filter:saturate(1.1)_brightness(0.8)]" alt="Banner" />}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--background)]/75 via-transparent to-[var(--background)]/35" />
          </div>
          {isOwnProfile && isEditing && (
            <BannerUpload onUpload={url => setEditForm(ef => ({ ...ef, bannerUrl: url }))} />
          )}
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 -mt-20 sm:-mt-24 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_230px] gap-5 sm:gap-6 items-start">
            <div className="flex flex-col items-center sm:flex-row sm:items-start gap-5 sm:gap-6">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <div
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 overflow-hidden bg-[var(--bg-card)] shadow-2xl relative"
                style={{ borderColor: "color-mix(in srgb, var(--accent) 40%, var(--background))", boxShadow: `0 0 24px color-mix(in srgb, var(--accent) 30%, transparent)` }}
              >
                {avatarLoading && <div className="absolute inset-0 kdr-skeleton z-10" />}
                <Image 
                  onLoad={() => setAvatarLoading(false)}
                  src={isEditing && editForm.avatarUrl ? editForm.avatarUrl : (profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=111827&color=fff`)} 
                  fill
                  sizes="(max-width: 640px) 112px, 128px"
                  className={`object-cover transition duration-300 ${avatarLoading ? "opacity-0" : "opacity-100"}`} 
                  alt={profile.name} 
                  unoptimized={isEditing && editForm.avatarUrl?.startsWith('blob') ? true : false}
                />
              </div>
              {isOwnProfile && isEditing && (
                <button onClick={() => setShowAvatarPicker(true)} className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition cursor-pointer rounded-full">
                  <Edit3 size={18} className="text-white" />
                </button>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 pt-2 sm:pt-4 w-full text-center sm:text-left">
              {isEditing ? (
                <div className="space-y-3">
                  <input value={editForm.name} onChange={e => setEditForm(ef => ({ ...ef, name: e.target.value }))} className="text-2xl font-black bg-transparent border-b border-white/35 text-white focus:outline-none w-full pb-1" />
                  <textarea value={editForm.bio} onChange={e => setEditForm(ef => ({ ...ef, bio: e.target.value }))} placeholder="Sua bio..." className="kdr-input w-full rounded-lg px-3 py-2 text-sm min-h-[80px] resize-none" />
                  
                  <label className="flex items-center gap-2 mt-2 cursor-pointer pb-2">
                    <input type="checkbox" checked={editForm.isPrivate} onChange={e => setEditForm(ef => ({ ...ef, isPrivate: e.target.checked }))} className="w-4 h-4 bg-[var(--bg-card)] border-[var(--border-default)] rounded" style={{ accentColor: "var(--accent)" }} />
                    <span className="text-sm font-bold text-[var(--text-secondary)] select-none">Perfil Privado (Ocultar histórico e favoritos)</span>
                  </label>

                  <div className="flex gap-2 flex-wrap">
                    <button onClick={handleSave} disabled={saving} className="kdr-btn-primary h-10 px-5 text-sm">
                      <Check size={14} /> {saving ? "Salvando..." : "Salvar"}
                    </button>
                    <Link href="/settings" className="kdr-btn-secondary h-10 px-4 text-sm">
                      Configurações
                    </Link>
                    <button onClick={() => setIsEditing(false)} className="kdr-btn-ghost h-10 px-4 text-sm">Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">{profile.name}</h1>
                    {isOwnProfile && (
                      <button onClick={() => setIsEditing(true)} className="p-2 text-[var(--text-muted)] hover:text-white hover:bg-white/10 rounded-lg transition">
                        <Edit3 size={16} />
                      </button>
                    )}
                    {!isOwnProfile && session && profile.canFollow !== false && (
                      <button onClick={handleFollow}
                        className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold transition min-h-[40px] border ${followData.isFollowing ? "bg-[var(--bg-card)] border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-white/10 hover:text-white hover:border-white/20" : "kdr-btn-primary"}`}
                      >
                        {followData.isFollowing ? "Seguindo" : "+ Seguir"}
                      </button>
                    )}
                    {!isOwnProfile && profile.canFollow === false && (
                      <span className="px-3 py-1 rounded-full bg-[var(--bg-card)] text-[var(--text-muted)] text-xs font-bold border border-[var(--border-subtle)]">
                        Seguidores desativados
                      </span>
                    )}
                  </div>
                  {profile.bio && <p className="text-[var(--text-muted)] text-sm mt-2 max-w-lg">{profile.bio}</p>}
                  <p className={`text-xs mt-2 font-bold ${profile.isOnline ? "text-emerald-300" : "text-[var(--text-muted)]"}`}>
                    {profile.isOnline ? "Online agora" : formatLastSeen(profile.lastActiveAt)}
                  </p>
                  <div className="grid grid-cols-2 sm:flex sm:gap-5 gap-2 mt-4 sm:mt-3 w-full sm:w-auto sm:flex-wrap">
                    <div onClick={() => loadFollowers("followers")} className="cursor-pointer rounded-xl p-3 sm:p-2 glass-card hover:bg-white/10 transition text-center sm:text-left">
                      <p className="font-black text-white text-lg">{followData.followersCount}</p>
                      <p className="text-[11px] text-[var(--text-muted)] group-hover:text-[var(--text-accent)]">Seguidores</p>
                    </div>
                    <div onClick={() => loadFollowers("following")} className="cursor-pointer rounded-xl p-3 sm:p-2 glass-card hover:bg-white/10 transition text-center sm:text-left">
                      <p className="font-black text-white text-lg">{followData.followingCount}</p>
                      <p className="text-[11px] text-[var(--text-muted)] group-hover:text-[var(--text-accent)]">Seguindo</p>
                    </div>
                    <div onClick={() => loadFollowers("friends")} className="cursor-pointer rounded-xl p-3 sm:p-2 glass-card hover:bg-white/10 transition text-center sm:text-left">
                      <p className="font-black text-white text-lg">{followData.friendsCount}</p>
                      <p className="text-[11px] text-[var(--text-muted)] group-hover:text-[var(--text-accent)]">Amigos</p>
                    </div>
                    <div className="rounded-xl p-3 sm:p-2 glass-card text-center sm:text-left">
                      <p className="font-black text-white text-lg">{profile.favorites?.length || 0}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">Favoritos</p>
                    </div>
                  </div>
                </>
              )}
            </div>
            </div>

            {!isEditing && (
              <aside className="grid grid-cols-2 lg:grid-cols-1 gap-2.5 w-full">
                {profileStats.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.label} className="glass-card border border-[var(--border-subtle)] rounded-2xl px-3 py-3 hover:border-[var(--border-default)] transition">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)] font-black">{card.label}</p>
                        <Icon size={13} className="kdr-section-title-accent" />
                      </div>
                      <p className="text-xl font-black text-white mt-1">{card.value}</p>
                    </div>
                  );
                })}
              </aside>
            )}
          </div>

          {!isEditing && (
            <section className="mt-8">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide border-y border-white/8 py-3">
                {PROFILE_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleTabChange(tab.key)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.08em] whitespace-nowrap transition border ${activeTab === tab.key ? "bg-white text-black border-white/70" : "bg-transparent text-zinc-500 border-transparent hover:text-white hover:bg-white/8"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {showTimeline && (
                <div className="relative mt-5">
                  <div className="hidden md:block absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px bg-white/10" />
                  <div className="space-y-3">
                    {timelineItems.map((item, idx) => (
                      <div key={item.id} className={`relative md:w-[48%] ${idx % 2 === 1 ? "md:ml-auto" : ""}`}>
                        <div className="glass-card border border-white/10 rounded-2xl px-4 py-3">
                          <p className="text-[10px] uppercase tracking-[0.16em] kdr-section-title-accent font-black">{item.accentTime}</p>
                          <p className="text-sm text-[var(--text-secondary)] mt-1">
                            Marcou o episódio {item.episodeNumber || "?"} de{" "}
                            <Link href={`/anime/${item.animeId}`} className="kdr-section-title-accent hover:text-white font-black">
                              {item.animeTitle}
                            </Link>{" "}
                            como assistido.
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {isPrivateForViewer ? (
            <div className="mt-12 text-center p-10 glass-card rounded-2xl border border-[var(--border-subtle)]">
              <Lock className="mx-auto mb-3 text-[var(--text-muted)]" size={32} />
              <h3 className="text-white font-bold mb-1 text-lg">Perfil Privado</h3>
              <p className="text-sm text-[var(--text-muted)]">Este usuário optou por manter seu histórico e favoritos privados.</p>
            </div>
          ) : (
            <>
              {showPostsPlaceholder && (
                <div className="mt-8 text-center p-10 glass-card rounded-2xl border border-[var(--border-subtle)]">
                  <h3 className="text-white font-bold mb-1 text-lg">Comentários em breve</h3>
                  <p className="text-sm text-[var(--text-muted)]">A aba de comentários sociais estará disponível em uma próxima atualização.</p>
                </div>
              )}

              {showMangasPlaceholder && (
                <div className="mt-8 text-center p-10 glass-card rounded-2xl border border-[var(--border-subtle)]">
                  <h3 className="text-white font-bold mb-1 text-lg">Mangás em breve</h3>
                  <p className="text-sm text-[var(--text-muted)]">A vitrine de mangás do perfil estará disponível em uma próxima atualização.</p>
                </div>
              )}

              {/* Watch History */}
              {showHistorySection && profile.histories && profile.histories.length > 0 && (
            <div className="mt-8">
              <h2 className="kdr-section-title mb-3"><Film size={14} className="kdr-section-title-accent" /> Histórico Recente</h2>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                {profile.histories.filter(h => !h.episode?.anime?.visibility || h.episode.anime.visibility === "public").slice(0, 10).map((h, i) => {
                  const anime = h.episode?.anime;
                  if (!anime) return null;
                  return (
                    <AnimeCard
                      key={i}
                      href={`/anime/${anime.id}`}
                      title={anime.title}
                      image={anime.coverImage}
                      className="w-[90px] sm:w-[110px]"
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Favorite Folders */}
          {showFavoritesSection && (looseFavorites.length > 0 || publicFolders.length > 0) && (
            <div className="mt-8">
              <h2 className="kdr-section-title mb-4"><Heart size={14} className="kdr-section-title-accent" /> Favoritos</h2>
              <div className="space-y-5">
                {looseFavorites.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-bold text-white text-sm">Sem pasta</span>
                      <span className="text-xs text-[var(--text-muted)]">({looseFavorites.length})</span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                      {looseFavorites.map(fav => (
                        <AnimeCard
                          key={fav.animeId}
                          href={`/anime/${fav.anime.id}`}
                          title={fav.anime.title}
                          image={fav.anime.coverImage}
                          className="w-[110px] sm:w-[120px]"
                        />
                      ))}
                    </div>
                  </div>
                )}
                {publicFolders.map(folder => {
                  const folderFavs = profile.favorites?.filter(f => f.folder?.id === folder.id && (!f.anime.visibility || f.anime.visibility === "public")) || [];
                  return (
                    <div key={folder.id}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="font-bold text-white text-sm">{folder.name}</span>
                        {folder.isPrivate && <Lock size={11} className="text-[var(--text-muted)]" />}
                        <span className="text-xs text-[var(--text-muted)]">({folderFavs.length})</span>
                      </div>
                      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                        {folderFavs.length === 0
                          ? <p className="text-[var(--text-muted)] text-xs">Pasta vazia.</p>
                          : folderFavs.map(fav => (
                              <AnimeCard
                                key={fav.animeId}
                                href={`/anime/${fav.anime.id}`}
                                title={fav.anime.title}
                                image={fav.anime.coverImage}
                                className="w-[110px] sm:w-[120px]"
                              />
                            ))
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showFavoritesSection && looseFavorites.length === 0 && publicFolders.length === 0 && activeTab === "favoritos" && (
            <div className="mt-8 text-center p-10 glass-card rounded-2xl border border-[var(--border-subtle)]">
              <h3 className="text-white font-bold mb-1 text-lg">Sem favoritos visíveis</h3>
              <p className="text-sm text-[var(--text-muted)]">Quando houver favoritos públicos, eles aparecerão aqui.</p>
            </div>
          )}
          </>)}
        </div>
      </div>

      {/* Followers Modal */}
      {showFollowUsers && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowFollowUsers(null)} />
          <div className="relative glass-surface-heavy rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 w-full max-w-sm animate-slideUpSheet sm:animate-scaleIn" style={{ paddingBottom: "calc(env(safe-area-inset-bottom,0px) + 1.25rem)" }}>
            <h3 className="font-bold text-lg mb-4 text-white">
              {showFollowUsers === "followers" ? "Seguidores" : showFollowUsers === "friends" ? "Amigos" : "Seguindo"}
            </h3>
            <div className="max-h-[50vh] overflow-y-auto space-y-3">
              {followList.length === 0 ? (
                <p className="text-[var(--text-muted)] text-sm text-center py-4">Nenhum usuário encontrado.</p>
              ) : (
                followList.map(u => (
                  <Link key={u.id} href={`/profile/${u.id}`} onClick={() => setShowFollowUsers(null)} className="flex items-center gap-3 p-2.5 hover:bg-white/[0.06] rounded-xl transition group">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 border border-[var(--border-subtle)]">
                      <Image src={u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=111827&color=fff`} fill sizes="40px" className="object-cover" alt="" />
                    </div>
                    <p className="text-sm font-bold text-[var(--text-secondary)] group-hover:text-white transition">{u.name}</p>
                  </Link>
                ))
              )}
            </div>
            <button onClick={() => setShowFollowUsers(null)} className="kdr-btn-secondary mt-4 w-full h-12 sm:h-10 text-sm">
              Fechar
            </button>
          </div>
        </div>
      )}

      {showAvatarPicker && (
         <AvatarPickerModal 
           onClose={() => setShowAvatarPicker(false)} 
           onSelect={(url) => { setEditForm(ef => ({ ...ef, avatarUrl: url })); setAvatarLoading(true); }} 
           currentUrl={editForm.avatarUrl || profile.avatarUrl || ""} 
         />
      )}
    </AppLayout>
  );
}
