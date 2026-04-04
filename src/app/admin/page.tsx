"use client";

import AppLayout from "@/components/AppLayout";
import SuggestionButton from "@/components/SuggestionButton";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Users, Film, MessageSquare, Megaphone, Plus, Trash2, Edit3,
  Clock, Eye, EyeOff, Check, X, UploadCloud, RefreshCw, Star,
  AlertTriangle, Search, Shield, Download, Power, ExternalLink, BookOpen, Bug, Smartphone, Loader2
} from "lucide-react";
import Link from "next/link";

type TabKey = "animes" | "mangas" | "bugs" | "users" | "suggestions" | "announcements";

interface User { id: string; name: string; email: string; role: string; avatarUrl?: string; isTimedOut?: string; lastActiveAt?: string | null; onlineNow?: boolean; _count: { favorites: number; histories: number } }
interface AdminUsersPayload {
  users: User[];
  onlineCount: number;
  onlineUsers: { id: string; name: string; avatarUrl?: string | null }[];
}
interface Anime { id: string; title: string; description?: string; coverImage?: string; bannerImage?: string; visibility: string; status: string; episodes?: { season: number }[]; categories?: { id: string; name: string; slug?: string }[] }
interface Manga {
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
  bannerImage?: string;
  malId?: number | null;
  malUrl?: string | null;
  visibility: string;
  status: string;
  source?: string | null;
  sourceId?: string | null;
  chapters?: { id: string }[];
  categories?: { id: string; name: string; slug?: string }[];
}
interface Suggestion { id: string; title: string; description?: string; status: string; user: { name: string; avatarUrl?: string }; createdAt: string }
interface Announcement { id: string; title: string; content: string; createdAt: string }
interface BugReport {
  id: string;
  title: string;
  description: string;
  status: "open" | "investigating" | "resolved" | "closed" | string;
  pagePath?: string | null;
  sourceUrl?: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; avatarUrl?: string | null };
  anime?: { id: string; title: string } | null;
  episode?: { id: string; number?: number | null; season?: number | null; title?: string | null } | null;
}

interface AnimeMediaOption {
  malId?: number;
  malUrl?: string;
  matchedTitle?: string;
  coverImage?: string;
  bannerImage?: string;
  description?: string;
  categories?: string[];
  score?: number;
}

function ImageUpload({ onUpload, label, accept = "image/*" }: { onUpload: (url: string) => void; label: string; accept?: string }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "uploads");
      const res = await fetch("/api/upload", { method: "POST", body: fd, signal: controller.signal });
      clearTimeout(timeout);
      const data = await res.json();
      if (data.url) {
        onUpload(data.url);
      } else {
        setUploadError("Falha no upload. Tente novamente.");
      }
    } catch {
      setUploadError("Tempo esgotado. Verifique o Supabase Storage.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className={`flex items-center gap-2 cursor-pointer text-xs font-bold transition ${uploading ? "text-zinc-500 cursor-not-allowed" : "text-red-400 hover:text-red-300"}`}>
        <UploadCloud size={14} />
        {uploading ? "Enviando..." : label}
        <input type="file" accept={accept} className="hidden" onChange={handleFile} disabled={uploading} />
      </label>
      {uploadError && <p className="text-red-400 text-xs mt-1">{uploadError}</p>}
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-fadeInUp">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle size={20} className="text-orange-400" />
          <h3 className="font-bold text-white">Confirmar ação</h3>
        </div>
        <p className="text-zinc-400 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl text-sm transition">Confirmar</button>
          <button onClick={onCancel} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2.5 rounded-xl text-sm transition">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function formatLastSeen(lastActiveAt?: string | null): string {
  if (!lastActiveAt) return "Nunca online";
  const diffMs = Date.now() - new Date(lastActiveAt).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return "Agora";

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Agora";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Visto há ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Visto há ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  return `Visto há ${diffDays} dia${diffDays > 1 ? "s" : ""}`;
}

interface EpItem {
  id: string;
  title: string;
  number: number;
  season: number;
  videoUrl?: string;
  sourceLabel?: string | null;
  introStartSec?: number | null;
  introEndSec?: number | null;
  outroStartSec?: number | null;
  outroEndSec?: number | null;
}

function EpisodeManager({
  animeId,
  animeName,
  showMsg,
  localFiles,
  localFolders,
  inputClass,
  labelClass,
}: {
  animeId: string;
  animeName: string;
  showMsg: (text: string, type?: "ok" | "err") => void;
  localFiles: any[];
  localFolders: string[];
  inputClass: string;
  labelClass: string;
}) {
  const [episodes, setEpisodes] = useState<EpItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<EpItem>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!animeId) return;
    fetch(`/api/admin/episode?animeId=${animeId}`)
      .then((r) => r.json())
      .then((data) => setEpisodes(data || []));
  }, [animeId]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (ep: EpItem) => {
    setEditingId(ep.id);
    setEditForm(ep);
  };

  const saveEdit = async () => {
    if (!editForm.id) return;
    setSaving(true);
    const res = await fetch("/api/admin/episode", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      showMsg("Episódio editado!");
      setEditingId(null);
      load();
    } else {
      showMsg("Erro ao salvar.", "err");
    }
    setSaving(false);
  };

  const deleteEp = async (id: string) => {
    setDeleting(id);
    const res = await fetch("/api/admin/episode", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      showMsg("Episódio removido.");
      load();
    } else {
      showMsg("Erro ao apagar.", "err");
    }
    setDeleting(null);
  };

  return (
    <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-base flex items-center gap-2">
          📋 Episódios de <span className="text-red-300">{animeName}</span>
          <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-400">{episodes.length}</span>
        </h3>
        <button onClick={load} className="text-zinc-500 hover:text-white transition p-1.5 rounded-lg hover:bg-zinc-800">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {episodes.map(ep => (
          <div key={ep.id} className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl overflow-hidden">
            {editingId === ep.id ? (
              /* ── EDIT MODE ── */
              <div className="p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>Nº</label>
                    <input type="number" className={inputClass} value={editForm.number ?? ""} onChange={e => setEditForm(f => ({ ...f, number: +e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelClass}>Temporada</label>
                    <input type="number" className={inputClass} value={editForm.season ?? ""} onChange={e => setEditForm(f => ({ ...f, season: +e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Título</label>
                  <input className={inputClass} value={editForm.title ?? ""} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>URL do Vídeo</label>
                  <input className={inputClass} value={editForm.videoUrl ?? ""} onChange={e => setEditForm(f => ({ ...f, videoUrl: e.target.value }))} placeholder="https://... ou /videos/..." />
                  {editForm.videoUrl && (
                    <p className="text-xs text-green-400 mt-1 font-mono truncate">✅ {editForm.videoUrl}</p>
                  )}
                  {/* Local file picker */}
                  {localFiles.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {localFiles.map(f => (
                        <button key={f.path} type="button"
                          onClick={() => setEditForm(form => ({ ...form, videoUrl: `/videos/${f.path}` }))}
                          className={`text-xs px-2 py-1 rounded border font-mono transition ${editForm.videoUrl === `/videos/${f.path}` ? "bg-green-600 border-green-500 text-white" : "bg-zinc-700 border-zinc-600 text-zinc-300 hover:border-red-500"}`}>
                          🎬 {f.folder ? `${f.folder}/` : ""}{f.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Intro/Outro timing */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>Início abertura (s)</label>
                    <input type="number" className={inputClass} value={(editForm as any).introStartSec ?? ""} onChange={e => setEditForm(f => ({ ...f, introStartSec: e.target.value ? +e.target.value : undefined }))} placeholder="ex: 90" />
                  </div>
                  <div>
                    <label className={labelClass}>Fim abertura (s)</label>
                    <input type="number" className={inputClass} value={(editForm as any).introEndSec ?? ""} onChange={e => setEditForm(f => ({ ...f, introEndSec: e.target.value ? +e.target.value : undefined }))} placeholder="ex: 210" />
                  </div>
                  <div>
                    <label className={labelClass}>Início encerramento (s)</label>
                    <input type="number" className={inputClass} value={(editForm as any).outroStartSec ?? ""} onChange={e => setEditForm(f => ({ ...f, outroStartSec: e.target.value ? +e.target.value : undefined }))} placeholder="ex: 1320" />
                  </div>
                  <div>
                    <label className={labelClass}>Fim encerramento (s)</label>
                    <input type="number" className={inputClass} value={(editForm as any).outroEndSec ?? ""} onChange={e => setEditForm(f => ({ ...f, outroEndSec: e.target.value ? +e.target.value : undefined }))} placeholder="ex: 1410" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition">
                    <Check size={12} /> {saving ? "Salvando..." : "Salvar"}
                  </button>
                  <button onClick={() => setEditingId(null)}
                    className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 font-bold rounded-lg text-xs transition">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ) : (
              /* ── VIEW MODE ── */
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-9 h-9 bg-red-600/20 border border-red-500/20 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-red-300 font-black text-sm">{ep.number}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{ep.title || `Episódio ${ep.number}`}</p>
                  <p className="text-xs text-zinc-500">T{ep.season} · {ep.videoUrl ? <span className="text-green-400 font-mono truncate inline-block max-w-[180px] align-bottom">{ep.videoUrl}</span> : <span className="text-red-400">Sem vídeo</span>}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => startEdit(ep)}
                    className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-blue-400 transition" title="Editar">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => { if (confirm(`Apagar "${ep.title || `Ep. ${ep.number}`}"?`)) deleteEp(ep.id); }}
                    disabled={deleting === ep.id}
                    className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition disabled:opacity-50" title="Apagar">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("animes");
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [onlineUsersMeta, setOnlineUsersMeta] = useState<AdminUsersPayload>({ users: [], onlineCount: 0, onlineUsers: [] });
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");
  const [confirm, setConfirm] = useState<{ message: string; action: () => void } | null>(null);
  const [animeSearch, setAnimeSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "public" | "admin_only">("all");
  const [mangaSearch, setMangaSearch] = useState("");
  const [mangaVisibilityFilter, setMangaVisibilityFilter] = useState<"all" | "public" | "admin_only">("all");
  const [bugStatusFilter, setBugStatusFilter] = useState<"all" | "open" | "investigating" | "resolved" | "closed">("all");

  // Anime form
  const [animeForm, setAnimeForm] = useState({ title: "", description: "", coverImage: "", bannerImage: "", status: "ongoing", visibility: "public" });
  const [mangaForm, setMangaForm] = useState({ title: "", description: "", coverImage: "", bannerImage: "", status: "ongoing", visibility: "public" });
  const [mobileFormView, setMobileFormView] = useState<"anime" | "episode">("anime");
  const [animeCategoriesInput, setAnimeCategoriesInput] = useState("");
  const [mangaCategoriesInput, setMangaCategoriesInput] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [editingAnime, setEditingAnime] = useState<string | null>(null);
  const [editingManga, setEditingManga] = useState<string | null>(null);
  const [syncingMangaId, setSyncingMangaId] = useState<string | null>(null);
  const [syncingMangaBatch, setSyncingMangaBatch] = useState(false);
  const [mangaSyncTranslatedOnly, setMangaSyncTranslatedOnly] = useState(true);
  const [mangaSyncReplaceChapters, setMangaSyncReplaceChapters] = useState(true);
  const [mangaSyncEnrichMetadata, setMangaSyncEnrichMetadata] = useState(true);
  const [mangaSyncVisibility, setMangaSyncVisibility] = useState<"keep" | "public" | "admin_only">("keep");
  const [mangaBatchProgress, setMangaBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [bannerPreview, setBannerPreview] = useState("");
  const [animeMediaLoading, setAnimeMediaLoading] = useState(false);
  const [animeMediaOptions, setAnimeMediaOptions] = useState<AnimeMediaOption[]>([]);
  const [mangaCoverPreview, setMangaCoverPreview] = useState("");
  const [mangaBannerPreview, setMangaBannerPreview] = useState("");
  // Ep form
  interface LocalFile { name: string; path: string; folder: string; }
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const [localFolders, setLocalFolders] = useState<string[]>([]);
  const [epForm, setEpForm] = useState({
    animeId: "",
    number: "",
    season: "1",
    title: "",
    videoUrl: "",
    sourceLabel: "",
    introStartSec: "",
    introEndSec: "",
  });
  const [episodeAnimeQuery, setEpisodeAnimeQuery] = useState("");
  const [episodePickerOpen, setEpisodePickerOpen] = useState(false);
  const [syncingAnimeId, setSyncingAnimeId] = useState<string | null>(null);
  // User forms
  const [timeoutForm, setTimeoutForm] = useState<{ [id: string]: string }>({});
  const [warningForm, setWarningForm] = useState<{ [id: string]: string }>({});
  const [editUserForm, setEditUserForm] = useState<{ [id: string]: { name: string; email: string; role: string } }>({});
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  // Announcement form
  const [annForm, setAnnForm] = useState({ title: "", content: "" });

  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("Estamos em manutencao. Voltamos em breve.");
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [animeTabEnabled, setAnimeTabEnabled] = useState(true);
  const [mangaTabEnabled, setMangaTabEnabled] = useState(false);
  const [navigationSaving, setNavigationSaving] = useState(false);
  const [mobileAppInfo, setMobileAppInfo] = useState<{ buildPageUrl: string; downloadUrl: string; hasDirectDownload: boolean } | null>(null);
  const [alertCounts, setAlertCounts] = useState({ openBugReportsCount: 0, pendingSuggestionsCount: 0 });
  const tabLoadInitializedRef = useRef(false);

  const showMsg = (text: string, type: "ok" | "err" = "ok") => {
    setMsg(text); setMsgType(type);
    setTimeout(() => setMsg(""), 4000);
  };

  const askConfirm = (message: string, action: () => void) => setConfirm({ message, action });

  const loadAnimes = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/anime");
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setAnimes(Array.isArray(data) ? data : []);
    } catch {
      setAnimes([]);
    }
  }, []);

  const loadMangas = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/manga");
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setMangas(Array.isArray(data) ? data : []);
    } catch {
      setMangas([]);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/users");
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      const rows: User[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.users)
          ? data.users
          : [];
      setUsers(rows);
      const onlineUsers = Array.isArray(data?.onlineUsers)
        ? data.onlineUsers
        : rows.filter((user) => user.onlineNow).map((user) => ({ id: user.id, name: user.name, avatarUrl: user.avatarUrl || null }));
      setOnlineUsersMeta({
        users: rows,
        onlineCount: typeof data?.onlineCount === "number" ? data.onlineCount : onlineUsers.length,
        onlineUsers,
      });
      const forms: typeof editUserForm = {};
      rows.forEach((user: User) => {
        forms[user.id] = { name: user.name, email: user.email, role: user.role };
      });
      setEditUserForm(forms);
    } catch {
      setUsers([]);
      setOnlineUsersMeta({ users: [], onlineCount: 0, onlineUsers: [] });
    }
  }, []);

  const loadSuggestions = useCallback(async () => {
    try {
      const response = await fetch("/api/suggestions");
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setSuggestions(Array.isArray(data) ? data : []);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const loadAnnouncements = useCallback(async () => {
    try {
      const response = await fetch("/api/announcements");
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch {
      setAnnouncements([]);
    }
  }, []);

  const loadBugReports = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/bug-reports");
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setBugReports(Array.isArray(data) ? data : []);
    } catch {
      setBugReports([]);
    }
  }, []);

  const loadAlertCounts = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/alerts");
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setAlertCounts({
        openBugReportsCount: Number(data?.openBugReportsCount || 0),
        pendingSuggestionsCount: Number(data?.pendingSuggestionsCount || 0),
      });
    } catch {
      setAlertCounts({ openBugReportsCount: 0, pendingSuggestionsCount: 0 });
    }
  }, []);

  const loadMobileAppInfo = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/mobile-app");
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      if (!data || data.error) return;
      setMobileAppInfo(data);
    } catch {
      setMobileAppInfo(null);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/categories");
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      setCategories(list.map((item: any) => ({ id: item.id, name: item.name })));
    } catch {
      setCategories([]);
    }
  }, []);

  const loadMaintenance = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/maintenance");
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setMaintenanceEnabled(Boolean(data?.enabled));
      if (data?.message) setMaintenanceMessage(data.message);
    } catch {
      setMaintenanceEnabled(false);
    }
  }, []);

  const loadNavigation = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/navigation");
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setAnimeTabEnabled(Boolean(data?.animeTabEnabled));
      setMangaTabEnabled(Boolean(data?.mangaTabEnabled));
    } catch {
      setAnimeTabEnabled(true);
      setMangaTabEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }
    // @ts-expect-error role
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/");
      return;
    }

    const boot = async () => {
      try {
        const response = await fetch("/api/local-files");
        if (response.ok) {
          const data = await response.json();
          setLocalFiles(data.files || []);
          setLocalFolders(data.folders || []);
        }
      } catch {
        setLocalFiles([]);
        setLocalFolders([]);
      }

      await loadAnimes();
      await loadMaintenance();
      await loadNavigation();
      await loadCategories();
      await loadMobileAppInfo();
      await loadAlertCounts();
    };

    if (status === "authenticated") {
      void boot();
    }
  }, [status, session, router, loadAnimes, loadMaintenance, loadNavigation, loadCategories, loadMobileAppInfo, loadAlertCounts]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!tabLoadInitializedRef.current) {
      tabLoadInitializedRef.current = true;
      return;
    }

    if (tab === "animes") {
      void loadAnimes();
      return;
    }

    if (tab === "mangas") {
      void loadMangas();
      return;
    }
    if (tab === "users") {
      void loadUsers();
      return;
    }
    if (tab === "suggestions") {
      void loadSuggestions();
      return;
    }
    if (tab === "announcements") {
      void loadAnnouncements();
      return;
    }
    if (tab === "bugs") {
      void loadBugReports();
    }
  }, [tab, status, loadAnimes, loadMangas, loadUsers, loadSuggestions, loadAnnouncements, loadBugReports]);

  useEffect(() => {
    const selected = animes.find((anime) => anime.id === epForm.animeId);
    if (!selected) return;
    setEpisodeAnimeQuery(selected.title);
  }, [epForm.animeId, animes]);

  // @ts-expect-error role
  if (status === "loading" || session?.user?.role !== "admin") return null;

  const handleAnimeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const categoryNames = animeCategoriesInput
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const method = editingAnime ? "PUT" : "POST";
    const body = editingAnime ? { ...animeForm, id: editingAnime, categoryNames } : { ...animeForm, categoryNames };
    const res = await fetch("/api/admin/anime", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      showMsg(editingAnime ? "Anime editado!" : "Anime adicionado ao catálogo!");
      setAnimeForm({ title: "", description: "", coverImage: "", bannerImage: "", status: "ongoing", visibility: "public" });
      setAnimeCategoriesInput("");
      setCoverPreview(""); setBannerPreview("");
      setAnimeMediaOptions([]);
      setEditingAnime(null); loadAnimes();
    } else {
      const raw = await res.text();
      let message = raw;
      try {
        const parsed = JSON.parse(raw);
        message = parsed?.error || parsed?.message || raw;
      } catch {
        // keep raw text
      }
      showMsg(message || "Erro ao salvar.", "err");
    }
  };

  const applyAnimeMediaOption = (option: AnimeMediaOption, overwriteExisting: boolean) => {
    const nextCover = overwriteExisting
      ? option.coverImage || animeForm.coverImage || ""
      : animeForm.coverImage || option.coverImage || "";
    const nextBanner = overwriteExisting
      ? option.bannerImage || animeForm.bannerImage || ""
      : animeForm.bannerImage || option.bannerImage || "";
    const nextDescription = overwriteExisting
      ? option.description || animeForm.description || ""
      : animeForm.description || option.description || "";

    const optionCategories = Array.from(new Set((option.categories || []).map((item) => item.trim()).filter(Boolean)));
    const currentCategories = animeCategoriesInput
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const nextCategories = overwriteExisting
      ? optionCategories
      : currentCategories.length > 0
        ? currentCategories
        : optionCategories;

    setAnimeForm((prev) => ({
      ...prev,
      coverImage: nextCover,
      bannerImage: nextBanner,
      description: nextDescription,
    }));
    if (nextCover) setCoverPreview(nextCover);
    if (nextBanner) setBannerPreview(nextBanner);
    if (nextCategories.length > 0) {
      setAnimeCategoriesInput(nextCategories.join(", "));
    }
  };

  const handleFetchAnimeMedia = async () => {
    const title = animeForm.title.trim();
    if (title.length < 2) {
      showMsg("Digite o título do anime para buscar capa/banner.", "err");
      return;
    }

    setAnimeMediaLoading(true);
    try {
      const res = await fetch(`/api/admin/anime/media?q=${encodeURIComponent(title)}&limit=10`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setAnimeMediaOptions([]);
        showMsg(data?.error || "Falha ao buscar mídia automática.", "err");
        return;
      }

      const options = Array.isArray(data?.options)
        ? (data.options as AnimeMediaOption[])
        : data?.media
          ? [data.media as AnimeMediaOption]
          : [];

      if (!data?.found || options.length === 0) {
        setAnimeMediaOptions([]);
        showMsg("Nenhuma capa/banner encontrada para esse anime.", "err");
        return;
      }

      setAnimeMediaOptions(options);

      const primary = options[0];
      applyAnimeMediaOption(primary, false);

      showMsg(
        `Mídia encontrada${primary?.matchedTitle ? `: ${primary.matchedTitle}` : ""}. ${options.length} opção(ões) do MAL disponível(is).`,
      );
    } catch {
      setAnimeMediaOptions([]);
      showMsg("Erro ao consultar mídia automática.", "err");
    } finally {
      setAnimeMediaLoading(false);
    }
  };

  const handleDeleteAnime = (id: string) => {
    askConfirm("Tem certeza que deseja apagar este anime? Esta ação é irreversível.", async () => {
      await fetch("/api/admin/anime", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      loadAnimes(); setConfirm(null); showMsg("Anime removido.");
    });
  };

  const handleToggleVisibility = async (a: Anime) => {
    await fetch("/api/admin/anime", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id, visibility: a.visibility === "public" ? "admin_only" : "public" })
    });
    loadAnimes();
  };

  const handleEpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!epForm.animeId) { showMsg("Selecione um anime.", "err"); return; }
    if (!epForm.number) { showMsg("Informe o número do episódio.", "err"); return; }
    if (!epForm.videoUrl.trim()) { showMsg("Informe a URL do vídeo ou selecione um arquivo local.", "err"); return; }
    const res = await fetch("/api/admin/episode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(epForm) });
    if (res.ok) { showMsg("Episódio salvo!"); setEpForm({ ...epForm, number: "", videoUrl: "", title: "" }); }
    else showMsg("Erro ao salvar episódio.", "err");
  };

  const handleTimeout = async (userId: string, untilOverride?: string | null) => {
    const until = untilOverride !== undefined ? untilOverride : (timeoutForm[userId] || null);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userId, timeoutUntil: until })
    });
    if (res.ok) { showMsg("Punição aplicada!"); loadUsers(); }
    else { const t = await res.text(); showMsg(t || "Erro ao aplicar punição.", "err"); }
  };

  const handleRemoveTimeout = async (userId: string) => {
    await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: userId, timeoutUntil: null }) });
    showMsg("Punição removida!"); loadUsers();
  };

  const applyTimeoutPreset = async (userId: string, preset: "1h" | "6h" | "24h" | "7d" | "30d" | "perm") => {
    const now = Date.now();
    const msMap: Record<"1h" | "6h" | "24h" | "7d" | "30d", number> = {
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };

    const until = preset === "perm"
      ? new Date("9999-12-31T23:59:59Z").toISOString()
      : new Date(now + msMap[preset]).toISOString();

    setTimeoutForm((prev) => ({ ...prev, [userId]: until.slice(0, 16) }));
    await handleTimeout(userId, until);
  };

  const handleWarnUser = async (userId: string) => {
    const warningMessage = warningForm[userId]?.trim();
    if (!warningMessage) {
      showMsg("Digite uma mensagem de aviso.", "err");
      return;
    }

    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userId, warningMessage }),
    });

    if (res.ok) {
      showMsg("Aviso enviado ao usuário.");
      setWarningForm((prev) => ({ ...prev, [userId]: "" }));
    } else {
      showMsg("Erro ao enviar aviso.", "err");
    }
  };

  const handleEditUser = async (userId: string) => {
    const form = editUserForm[userId];
    if (!form) return;
    const res = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: userId, ...form }) });
    if (res.ok) { showMsg("Usuário editado!"); loadUsers(); setExpandedUser(null); }
    else { const t = await res.text(); showMsg(t || "Erro ao editar usuário.", "err"); }
  };

  const handleDeleteUser = (id: string) => {
    askConfirm("Deseja deletar este usuário permanentemente?", async () => {
      const res = await fetch("/api/admin/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (res.ok) { showMsg("Usuário deletado."); loadUsers(); }
      else { const t = await res.text(); showMsg(t || "Erro ao deletar.", "err"); }
      setConfirm(null);
    });
  };

  const handleSuggestionStatus = async (id: string, newStatus: string) => {
    await fetch("/api/suggestions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: newStatus }) });
    await loadSuggestions();
    await loadAlertCounts();
  };

  const handleDeleteSuggestion = (id: string) => {
    askConfirm("Apagar esta sugestão?", async () => {
      await fetch("/api/suggestions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      await loadSuggestions();
      await loadAlertCounts();
      setConfirm(null);
      showMsg("Sugestão removida.");
    });
  };

  const handleAnnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(annForm) });
    if (res.ok) { showMsg("Anúncio publicado!"); setAnnForm({ title: "", content: "" }); loadAnnouncements(); }
    else showMsg("Erro ao publicar anúncio.", "err");
  };

  const handleDeleteAnn = (id: string) => {
    askConfirm("Apagar este anúncio?", async () => {
      await fetch("/api/announcements", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      loadAnnouncements(); setConfirm(null); showMsg("Anúncio removido.");
    });
  };

  const handleSaveMaintenance = async () => {
    setMaintenanceSaving(true);
    const res = await fetch("/api/admin/maintenance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: maintenanceEnabled, message: maintenanceMessage }),
    });
    if (res.ok) {
      showMsg(maintenanceEnabled ? "Modo manutenção ativado." : "Modo manutenção desativado.");
      loadMaintenance();
    } else {
      showMsg("Falha ao salvar manutenção.", "err");
    }
    setMaintenanceSaving(false);
  };

  const handleSaveNavigation = async () => {
    setNavigationSaving(true);
    const res = await fetch("/api/admin/navigation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ animeTabEnabled, mangaTabEnabled }),
    });

    if (res.ok) {
      showMsg("Visibilidade das abas atualizada.");
      loadNavigation();
    } else {
      showMsg("Falha ao salvar abas de navegacao.", "err");
    }
    setNavigationSaving(false);
  };

  const parseImportMeta = (description?: string) => {
    if (!description) return { provider: "", externalId: "", query: "" };
    const marker = description.match(/\[import-meta\s+([^\]]+)\]/i)?.[1] || "";
    if (!marker) return { provider: "", externalId: "", query: "" };

    const parts = marker
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
      provider: parts.provider || "",
      externalId: parts.externalid || parts.external_id || "",
      query: parts.query || "",
    };
  };

  const handleSyncAnime = async (anime: Anime) => {
    if (syncingAnimeId) return;

    const meta = parseImportMeta(anime.description);
    setSyncingAnimeId(anime.id);
    try {
      const res = await fetch("/api/admin/anime/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animeId: anime.id,
          provider: meta.provider || undefined,
          externalId: meta.externalId || undefined,
          query: meta.query || anime.title,
          limit: 50,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showMsg(data?.error || "Falha ao atualizar episódios via API.", "err");
        return;
      }

      const imported = Number(data?.imported || 0);
      if (imported > 0) {
        showMsg(`${anime.title}: ${imported} novo(s) episódio(s) via ${data?.providerUsed || "API"}.`, "ok");
      } else {
        showMsg(`${anime.title}: nenhum episódio novo encontrado.`, "ok");
      }
    } catch {
      showMsg("Erro ao sincronizar episódios por API.", "err");
    } finally {
      setSyncingAnimeId(null);
    }
  };

  const handleMangaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const categoryNames = mangaCategoriesInput
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    const method = editingManga ? "PUT" : "POST";
    const body = editingManga
      ? { ...mangaForm, id: editingManga, categoryNames }
      : { ...mangaForm, categoryNames };

    const res = await fetch("/api/admin/manga", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      showMsg(editingManga ? "Manga atualizado!" : "Manga adicionado!");
      setMangaForm({ title: "", description: "", coverImage: "", bannerImage: "", status: "ongoing", visibility: "public" });
      setMangaCategoriesInput("");
      setEditingManga(null);
      setMangaCoverPreview("");
      setMangaBannerPreview("");
      loadMangas();
      return;
    }

    const raw = await res.text();
    let message = raw;
    try {
      const parsed = JSON.parse(raw);
      message = parsed?.error || parsed?.message || raw;
    } catch {
      // keep raw text
    }
    showMsg(message || "Erro ao salvar manga.", "err");
  };

  const handleDeleteManga = (id: string) => {
    askConfirm("Tem certeza que deseja apagar este manga?", async () => {
      await fetch("/api/admin/manga", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      loadMangas();
      setConfirm(null);
      showMsg("Manga removido.");
    });
  };

  const handleToggleMangaVisibility = async (manga: Manga) => {
    await fetch("/api/admin/manga", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: manga.id,
        visibility: manga.visibility === "public" ? "admin_only" : "public",
      }),
    });
    loadMangas();
  };

  const shouldRetryMangaSync = (status: number, data: any) => {
    if ([429, 503, 504].includes(status)) return true;
    const message = String(data?.error || "").toLowerCase();
    return (
      message.includes("limite") ||
      message.includes("temporario") ||
      message.includes("timeout") ||
      message.includes("rate")
    );
  };

  const syncMangaOnce = async (manga: Manga) => {
    const payload: Record<string, unknown> = {
      mangaId: manga.id,
      translatedOnly: mangaSyncTranslatedOnly,
      replaceChapters: mangaSyncReplaceChapters,
      enrichMetadata: mangaSyncEnrichMetadata,
    };

    if (mangaSyncVisibility !== "keep") {
      payload.visibility = mangaSyncVisibility;
    }

    const res = await fetch("/api/admin/manga/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  };

  const handleSyncManga = async (manga: Manga) => {
    if (syncingMangaId || syncingMangaBatch) return;
    setSyncingMangaId(manga.id);

    try {
      let result = await syncMangaOnce(manga);

      if (!result.ok && shouldRetryMangaSync(result.status, result.data)) {
        await new Promise((resolve) => setTimeout(resolve, 1200 + Math.floor(Math.random() * 650)));
        result = await syncMangaOnce(manga);
      }

      if (!result.ok) {
        const data = result.data;
        showMsg(data?.error || "Falha ao sincronizar manga.", "err");
        return;
      }

      const data = result.data;
      const metadataSuffix = data?.malEnriched
        ? " + metadados MAL"
        : mangaSyncEnrichMetadata
        ? " (sem match MAL)"
        : "";

      showMsg(
        `${manga.title}: ${Number(data?.imported || 0)} capítulo(s) atualizado(s) em ${Number(data?.pagesFetched || 1)} página(s)${metadataSuffix}.`,
      );
      loadMangas();
    } catch {
      showMsg("Erro ao sincronizar manga.", "err");
    } finally {
      setSyncingMangaId(null);
    }
  };

  const handleSyncVisibleMangas = async () => {
    if (syncingMangaId || syncingMangaBatch) return;
    if (visibleFilteredMangas.length === 0) {
      showMsg("Nenhum manga visível para sincronizar.", "err");
      return;
    }

    setSyncingMangaBatch(true);
    setMangaBatchProgress({ done: 0, total: visibleFilteredMangas.length });

    let okCount = 0;
    let failedCount = 0;
    let totalImported = 0;
    const failedTitles: string[] = [];

    try {
      for (let index = 0; index < visibleFilteredMangas.length; index += 1) {
        const manga = visibleFilteredMangas[index];
        setSyncingMangaId(manga.id);

        try {
          let result = await syncMangaOnce(manga);

          if (!result.ok && shouldRetryMangaSync(result.status, result.data)) {
            await new Promise((resolve) => setTimeout(resolve, 1200 + Math.floor(Math.random() * 700)));
            result = await syncMangaOnce(manga);
          }

          if (result.ok) {
            okCount += 1;
            totalImported += Number(result.data?.imported || 0);
          } else {
            failedCount += 1;
            if (failedTitles.length < 3) {
              failedTitles.push(manga.title);
            }
          }
        } catch {
          failedCount += 1;
          if (failedTitles.length < 3) {
            failedTitles.push(manga.title);
          }
        }

        setMangaBatchProgress({ done: index + 1, total: visibleFilteredMangas.length });
        await new Promise((resolve) => setTimeout(resolve, 280));
      }

      loadMangas();

      const failedHint =
        failedTitles.length > 0
          ? ` Falhas em: ${failedTitles.join(", ")}${failedCount > failedTitles.length ? "..." : ""}`
          : "";

      showMsg(
        `Sincronização em lote concluída: ${okCount} ok, ${failedCount} falha(s), ${totalImported} capítulo(s) importado(s).${failedHint}`,
        failedCount > 0 ? "err" : "ok",
      );
    } finally {
      setSyncingMangaId(null);
      setSyncingMangaBatch(false);
      setMangaBatchProgress(null);
    }
  };

  const handleBugStatus = async (id: string, status: string) => {
    const res = await fetch("/api/admin/bug-reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      await loadBugReports();
      await loadAlertCounts();
    } else {
      showMsg("Falha ao atualizar status do bug.", "err");
    }
  };

  const handleDeleteBug = (id: string) => {
    askConfirm("Remover este bug report?", async () => {
      await fetch("/api/admin/bug-reports", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await loadBugReports();
      await loadAlertCounts();
      setConfirm(null);
      showMsg("Bug report removido.");
    });
  };

  const tabClass = (key: TabKey) =>
    `flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${tab === key ? "bg-red-600 text-white shadow-[0_0_15px_rgba(229,9,20,0.35)]" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`;

  const inputClass = "w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-500 transition";
  const labelClass = "text-xs font-bold text-zinc-400 mb-1 block";

  const filteredAnimes = animeSearch
    ? animes.filter(a => a.title.toLowerCase().includes(animeSearch.toLowerCase()))
    : animes;

  const visibleFilteredAnimes = filteredAnimes.filter((anime) =>
    visibilityFilter === "all" ? true : anime.visibility === visibilityFilter,
  );

  const filteredMangas = mangaSearch
    ? mangas.filter((manga) => manga.title.toLowerCase().includes(mangaSearch.toLowerCase()))
    : mangas;

  const visibleFilteredMangas = filteredMangas.filter((manga) =>
    mangaVisibilityFilter === "all" ? true : manga.visibility === mangaVisibilityFilter,
  );

  const filteredBugReports = bugReports.filter((report) =>
    bugStatusFilter === "all" ? true : report.status === bugStatusFilter,
  );

  const openBugReportsCount =
    bugReports.length > 0
      ? bugReports.filter((report) => report.status === "open").length
      : alertCounts.openBugReportsCount;
  const pendingSuggestionsCount =
    suggestions.length > 0
      ? suggestions.filter((suggestion) => suggestion.status === "pending").length
      : alertCounts.pendingSuggestionsCount;

  const filteredEpisodeAnimes = episodeAnimeQuery.trim()
    ? animes.filter((anime) => anime.title.toLowerCase().includes(episodeAnimeQuery.trim().toLowerCase())).slice(0, 40)
    : animes.slice(0, 40);

  return (
    <AppLayout>
      {confirm && <ConfirmModal message={confirm.message} onConfirm={confirm.action} onCancel={() => setConfirm(null)} />}

      <div className="p-6 lg:p-10 pb-24 max-w-7xl mx-auto space-y-6">
        <div className="animate-fadeInUp">
          <h1 className="text-3xl font-black flex items-center gap-3">
            <span className="text-red-500">Painel</span> Admin
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Gerencie o Futuro sem Contexto.</p>
        </div>

        <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 space-y-3 animate-fadeInUp">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-bold text-sm uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <Power size={14} className="text-red-400" /> Modo manutenção
            </h2>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <span className={`text-xs font-bold ${maintenanceEnabled ? "text-orange-300" : "text-zinc-500"}`}>
                {maintenanceEnabled ? "Ativo" : "Desativado"}
              </span>
              <input
                type="checkbox"
                checked={maintenanceEnabled}
                onChange={(e) => setMaintenanceEnabled(e.target.checked)}
                className="sr-only"
              />
              <span
                onClick={() => setMaintenanceEnabled((prev) => !prev)}
                className={`relative w-11 h-6 rounded-full transition ${maintenanceEnabled ? "bg-orange-500" : "bg-zinc-700"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition ${maintenanceEnabled ? "translate-x-5" : ""}`} />
              </span>
            </label>
          </div>
          <textarea
            value={maintenanceMessage}
            onChange={(e) => setMaintenanceMessage(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 min-h-[72px]"
            placeholder="Mensagem exibida para usuários durante a manutenção"
          />
          <button
            onClick={handleSaveMaintenance}
            disabled={maintenanceSaving}
            className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-sm font-bold transition"
          >
            {maintenanceSaving ? "Salvando..." : "Salvar manutenção"}
          </button>
        </section>

        <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 space-y-3 animate-fadeInUp">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-bold text-sm uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <Power size={14} className="text-emerald-300" /> Abas do app (usuarios)
            </h2>
            <p className="text-[11px] text-zinc-500">Admins sempre veem Anime e Manga.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950/70 px-3 py-2.5 text-sm">
              <span className="font-semibold text-zinc-300">Aba Animes</span>
              <input type="checkbox" checked={animeTabEnabled} onChange={(e) => setAnimeTabEnabled(e.target.checked)} />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950/70 px-3 py-2.5 text-sm">
              <span className="font-semibold text-zinc-300">Aba Mangas</span>
              <input type="checkbox" checked={mangaTabEnabled} onChange={(e) => setMangaTabEnabled(e.target.checked)} />
            </label>
          </div>

          <button
            onClick={handleSaveNavigation}
            disabled={navigationSaving}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-bold transition"
          >
            {navigationSaving ? "Salvando..." : "Salvar abas"}
          </button>
        </section>

        <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 space-y-3 animate-fadeInUp">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-bold text-sm uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <Smartphone size={14} className="text-cyan-300" /> App mobile (somente admin)
            </h2>
            <button
              onClick={loadMobileAppInfo}
              className="text-zinc-500 hover:text-white transition p-2 hover:bg-zinc-800 rounded-lg"
              title="Atualizar links"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {!mobileAppInfo ? (
            <p className="text-xs text-zinc-500">Sem informações de build no momento.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {mobileAppInfo.hasDirectDownload && mobileAppInfo.downloadUrl && (
                <a
                  href={mobileAppInfo.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition"
                >
                  Baixar APK (admin)
                </a>
              )}
              {mobileAppInfo.buildPageUrl && (
                <a
                  href={mobileAppInfo.buildPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition"
                >
                  Abrir página da build
                </a>
              )}
            </div>
          )}
          <p className="text-[11px] text-zinc-500">Esse acesso fica apenas no painel admin e não aparece para usuários comuns.</p>
        </section>

        <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 space-y-3 animate-fadeInUp">
          <h2 className="font-bold text-sm uppercase tracking-wider text-zinc-200 flex items-center gap-2">
            <Bug size={14} className="text-amber-300" /> Feedback interno
          </h2>
          <p className="text-xs text-zinc-400">
            Envie sugestão ou reporte bug direto daqui quando estiver revisando o painel.
          </p>
          <SuggestionButton
            variant="sidebar"
            mobileSidebar={true}
            forceVisible={true}
            className="w-full sm:w-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10 hover:text-white transition"
          />
        </section>

        {msg && (
          <div className={`p-3 rounded-xl text-sm font-bold border animate-fadeInUp ${msgType === "ok" ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}`}>
            {msg}
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-fadeInUp">
          <button
            type="button"
            onClick={() => setTab("bugs")}
            className="text-left rounded-2xl border border-red-500/30 bg-red-500/10 p-4 hover:bg-red-500/16 transition"
          >
            <p className="text-[10px] uppercase tracking-[0.16em] text-red-200 font-black">Alertas de bug</p>
            <p className="text-2xl font-black text-white mt-1">{openBugReportsCount}</p>
            <p className="text-xs text-zinc-300 mt-1">Em aberto para revisão</p>
          </button>

          <button
            type="button"
            onClick={() => setTab("suggestions")}
            className="text-left rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 hover:bg-amber-500/16 transition"
          >
            <p className="text-[10px] uppercase tracking-[0.16em] text-amber-200 font-black">Sugestoes pendentes</p>
            <p className="text-2xl font-black text-white mt-1">{pendingSuggestionsCount}</p>
            <p className="text-xs text-zinc-300 mt-1">Aguardando moderação</p>
          </button>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500 font-black">Usuarios online</p>
            <p className="text-2xl font-black text-white mt-1">{onlineUsersMeta.onlineCount || 0}</p>
            <p className="text-xs text-zinc-400 mt-1">Presenca em tempo quase real</p>
          </div>
        </section>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          <button className={tabClass("animes")} onClick={() => setTab("animes")}><Film size={16} /> Animes</button>
          <button className={tabClass("mangas")} onClick={() => setTab("mangas")}><BookOpen size={16} /> Mangas</button>
          <button className={tabClass("bugs")} onClick={() => setTab("bugs")}>
            <Bug size={16} /> Bugs
            {openBugReportsCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black leading-none">
                {openBugReportsCount > 99 ? "99+" : openBugReportsCount}
              </span>
            )}
          </button>
          <button className={tabClass("users")} onClick={() => setTab("users")}><Users size={16} /> Usuários</button>
          <button className={tabClass("suggestions")} onClick={() => setTab("suggestions")}>
            <Star size={16} /> Sugestões
            {pendingSuggestionsCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black leading-none">
                {pendingSuggestionsCount > 99 ? "99+" : pendingSuggestionsCount}
              </span>
            )}
          </button>
          <button className={tabClass("announcements")} onClick={() => setTab("announcements")}><Megaphone size={16} /> Anúncios</button>
        </div>

        {/* ── ANIMES TAB ── */}
        {tab === "animes" && (
          <div className="space-y-8 animate-fadeInUp">
            <div className="md:hidden flex items-center gap-2 bg-zinc-900/40 border border-zinc-800 rounded-xl p-1.5">
              <button
                type="button"
                onClick={() => setMobileFormView("anime")}
                className={`flex-1 py-2 rounded-lg text-xs font-black transition ${mobileFormView === "anime" ? "bg-red-600 text-white" : "text-zinc-400"}`}
              >
                Cadastro Anime
              </button>
              <button
                type="button"
                onClick={() => setMobileFormView("episode")}
                className={`flex-1 py-2 rounded-lg text-xs font-black transition ${mobileFormView === "episode" ? "bg-blue-600 text-white" : "text-zinc-400"}`}
              >
                Cadastro Episodio
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Anime Form */}
              <section className={`bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-4 ${mobileFormView === "anime" ? "block" : "hidden md:block"}`}>
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-lg">{editingAnime ? "✏️ Editar Anime" : "➕ Adicionar Anime"}</h2>
                  {!editingAnime && (
                    <Link href="/admin/import" className="flex items-center gap-2 bg-red-500/10 text-red-300 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-black transition border border-red-500/30">
                      <Download size={14} /> IMPORTAR API
                    </Link>
                  )}
                </div>
                <form onSubmit={handleAnimeSubmit} className="space-y-3">
                  <div>
                    <label className={labelClass}>Título *</label>
                    <input
                      required
                      className={inputClass}
                      value={animeForm.title}
                      onChange={e => {
                        setAnimeForm({ ...animeForm, title: e.target.value });
                        setAnimeMediaOptions([]);
                      }}
                      placeholder="Ex: Naruto Shippuden"
                    />
                  </div>
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={handleFetchAnimeMedia}
                      disabled={animeMediaLoading}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-black transition disabled:opacity-50"
                    >
                      {animeMediaLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                      Buscar capa/banner automático
                    </button>
                  </div>
                  {animeMediaOptions.length > 0 && (
                    <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-3 space-y-2">
                      <p className="text-[11px] font-black uppercase tracking-wide text-zinc-400">
                        Opções MyAnimeList ({animeMediaOptions.length})
                      </p>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {animeMediaOptions.map((option, idx) => (
                          <div key={`${option.malId || option.malUrl || option.matchedTitle || idx}`} className="rounded-lg border border-zinc-700 bg-zinc-950/70 p-2 flex items-center gap-2">
                            <img
                              src={option.coverImage || option.bannerImage || "/logo.png"}
                              alt={option.matchedTitle || `MAL ${idx + 1}`}
                              className="w-11 h-16 rounded object-cover border border-zinc-700 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-white truncate">
                                {option.matchedTitle || `Resultado ${idx + 1}`}
                              </p>
                              <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500 flex-wrap">
                                {option.malId && <span>#MAL {option.malId}</span>}
                                {Number.isFinite(Number(option.score)) && (
                                  <span className="text-emerald-400">Score {Math.round(Number(option.score))}</span>
                                )}
                                {option.malUrl && (
                                  <a
                                    href={option.malUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
                                  >
                                    Ver no MAL <ExternalLink size={11} />
                                  </a>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                applyAnimeMediaOption(option, true);
                                showMsg(`Mídia aplicada: ${option.matchedTitle || `opção ${idx + 1}`}.`);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-black transition"
                            >
                              Usar
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className={labelClass}>Sinopse</label>
                    <textarea className={inputClass + " min-h-[80px] resize-none"} value={animeForm.description} onChange={e => setAnimeForm({ ...animeForm, description: e.target.value })} placeholder="Descrição..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Capa (URL)</label>
                      <input className={inputClass} value={animeForm.coverImage} onChange={e => { setAnimeForm({ ...animeForm, coverImage: e.target.value }); setCoverPreview(e.target.value); }} placeholder="https://..." />
                      <div className="mt-1">
                        <ImageUpload label="Upload imagem" onUpload={url => { setAnimeForm({ ...animeForm, coverImage: url }); setCoverPreview(url); }} />
                      </div>
                      {coverPreview && <img src={coverPreview} alt="preview" className="mt-2 w-16 h-24 object-cover rounded-lg border border-zinc-700" />}
                    </div>
                    <div>
                      <label className={labelClass}>Banner (URL)</label>
                      <input className={inputClass} value={animeForm.bannerImage} onChange={e => { setAnimeForm({ ...animeForm, bannerImage: e.target.value }); setBannerPreview(e.target.value); }} placeholder="https://..." />
                      <div className="mt-1">
                        <ImageUpload label="Upload imagem" onUpload={url => { setAnimeForm({ ...animeForm, bannerImage: url }); setBannerPreview(url); }} />
                      </div>
                      {bannerPreview && <img src={bannerPreview} alt="preview" className="mt-2 w-full h-10 object-cover rounded-lg border border-zinc-700" />}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Categorias (separe por virgula)</label>
                    <input
                      className={inputClass}
                      value={animeCategoriesInput}
                      onChange={(e) => setAnimeCategoriesInput(e.target.value)}
                      placeholder="Ex: Acao, Aventura, Romance"
                    />
                    {categories.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {categories.slice(0, 16).map((category) => (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => {
                              const current = animeCategoriesInput
                                .split(",")
                                .map((part) => part.trim())
                                .filter(Boolean);
                              if (current.includes(category.name)) return;
                              setAnimeCategoriesInput([...current, category.name].join(", "));
                            }}
                            className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold transition"
                          >
                            {category.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Status</label>
                      <select className={inputClass} value={animeForm.status} onChange={e => setAnimeForm({ ...animeForm, status: e.target.value })}>
                        <option value="ongoing">Em Andamento</option>
                        <option value="completed">Completo</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Visibilidade</label>
                      <select
                        className={inputClass}
                        value={animeForm.visibility}
                        onChange={(e) => setAnimeForm({ ...animeForm, visibility: e.target.value })}
                      >
                        <option value="public">Publico</option>
                        <option value="admin_only">So admin</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2">
                      <Plus size={16} /> {editingAnime ? "Atualizar" : "Adicionar ao Catálogo"}
                    </button>
                    {editingAnime && (
                      <button type="button" onClick={() => { setEditingAnime(null); setAnimeForm({ title: "", description: "", coverImage: "", bannerImage: "", status: "ongoing", visibility: "public" }); setAnimeCategoriesInput(""); setCoverPreview(""); setBannerPreview(""); setAnimeMediaOptions([]); }}
                        className="px-4 py-2.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-sm transition">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </form>
              </section>

              {/* Episode Form */}
              <section className={`bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-4 ${mobileFormView === "episode" ? "block" : "hidden md:block"}`}>
                <h2 className="font-bold text-lg">🎬 Adicionar Episódio</h2>
                <form onSubmit={handleEpSubmit} className="space-y-3">
                  <div>
                    <label className={labelClass}>Anime</label>
                    <input
                      className={inputClass}
                      value={episodeAnimeQuery}
                      onFocus={() => setEpisodePickerOpen(true)}
                      onBlur={() => setTimeout(() => setEpisodePickerOpen(false), 120)}
                      onChange={(e) => {
                        setEpisodeAnimeQuery(e.target.value);
                        setEpisodePickerOpen(true);
                        if (epForm.animeId) {
                          setEpForm((prev) => ({ ...prev, animeId: "" }));
                        }
                      }}
                      placeholder="Digite para buscar anime..."
                    />
                    {epForm.animeId && (
                      <p className="mt-1 text-[11px] text-green-400 font-bold truncate">
                        Selecionado: {animes.find((anime) => anime.id === epForm.animeId)?.title || "Anime"}
                      </p>
                    )}

                    {episodePickerOpen && (
                      <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950/95 p-1.5 space-y-1">
                        {filteredEpisodeAnimes.map((anime) => (
                          <button
                            key={anime.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setEpForm((prev) => ({ ...prev, animeId: anime.id }));
                              setEpisodeAnimeQuery(anime.title);
                              setEpisodePickerOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                              epForm.animeId === anime.id
                                ? "bg-red-600/20 border border-red-500/40 text-red-100"
                                : "bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-white"
                            }`}
                          >
                            <span className="font-bold">{anime.title}</span>
                          </button>
                        ))}

                        {filteredEpisodeAnimes.length === 0 && (
                          <p className="px-3 py-2 text-xs text-zinc-500">Nenhum anime encontrado para essa busca.</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div><label className={labelClass}>Título do Episódio</label><input className={inputClass} value={epForm.title} onChange={e => setEpForm({ ...epForm, title: e.target.value })} placeholder="Ex: O Retorno do Herói" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelClass}>Número *</label><input required type="number" className={inputClass} value={epForm.number} onChange={e => setEpForm({ ...epForm, number: e.target.value })} /></div>
                    <div><label className={labelClass}>Temporada *</label><input required type="number" className={inputClass} value={epForm.season} onChange={e => setEpForm({ ...epForm, season: e.target.value })} /></div>
                  </div>
                  {/* ── VIDEO SECTION ── */}
                  <div className="space-y-2">
                    <label className={labelClass}>Vídeo</label>

                    {/* Selected file indicator */}
                    {epForm.videoUrl && (
                      <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/40 rounded-xl px-3 py-2">
                        <span className="text-green-400 text-xs font-black">✅ Selecionado:</span>
                        <span className="text-green-300 text-xs font-mono truncate">{epForm.videoUrl}</span>
                        <button type="button" onClick={() => setEpForm({ ...epForm, videoUrl: "" })} className="ml-auto text-zinc-500 hover:text-red-400 transition text-xs">✕</button>
                      </div>
                    )}

                    {/* URL input */}
                    <input
                      className={inputClass}
                      value={epForm.videoUrl}
                      onChange={e => setEpForm({ ...epForm, videoUrl: e.target.value })}
                      placeholder="Cole aqui URL do Google Drive, YouTube, etc."
                    />

                    {/* Local file picker */}
                    {localFiles.length > 0 ? (
                      <div className="bg-zinc-900/60 border border-zinc-700 rounded-xl p-3 space-y-2">
                        <p className="text-xs font-bold text-red-300">📁 Arquivos em <code className="text-zinc-300">public/videos/</code> — clique para selecionar:</p>

                        {/* Root files */}
                        {localFiles.filter(f => !f.folder).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {localFiles.filter(f => !f.folder).map(f => (
                              <button key={f.path} type="button"
                                onClick={() => setEpForm(prev => ({ ...prev, videoUrl: `/videos/${f.path}` }))}
                                className={`text-xs px-3 py-1.5 rounded-lg border transition font-mono truncate max-w-[180px] ${
                                  epForm.videoUrl === `/videos/${f.path}`
                                    ? "bg-green-600 border-green-500 text-white"
                                    : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:border-red-500"
                                }`}>
                                🎬 {f.name}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Subfolder groups */}
                        {localFolders.map(folder => (
                          <div key={folder}>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">📂 {folder}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {localFiles.filter(f => f.folder === folder).map(f => (
                                <button key={f.path} type="button"
                                  onClick={() => setEpForm(prev => ({
                                    ...prev,
                                    videoUrl: `/videos/${f.path}`,
                                    title: prev.title || f.name.replace(/\.[^.]+$/, ""),
                                  }))}
                                  className={`text-xs px-3 py-1.5 rounded-lg border transition font-mono truncate max-w-[180px] ${
                                    epForm.videoUrl === `/videos/${f.path}`
                                      ? "bg-green-600 border-green-500 text-white"
                                      : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:border-red-500"
                                  }`}>
                                  🎬 {f.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-600">📂 Nenhum arquivo local detectado. Coloque mp4s em <code>public/videos/</code> ou use URL acima.</p>
                    )}
                  </div>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2">
                    <Plus size={16} /> Salvar Episódio
                  </button>
                </form>
              </section>

              {/* Episode Manager */}
              {epForm.animeId && (
                <div className={mobileFormView === "episode" ? "block" : "hidden md:block"}>
                  <EpisodeManager
                    animeId={epForm.animeId}
                    animeName={animes.find(a => a.id === epForm.animeId)?.title || ""}
                    showMsg={showMsg}
                    localFiles={localFiles}
                    localFolders={localFolders}
                    inputClass={inputClass}
                    labelClass={labelClass}
                  />
                </div>
              )}
            </div>

            {/* Anime List */}
            <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div>
                  <h2 className="font-bold text-lg">Catálogo ({animes.length})</h2>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Use o ícone <RefreshCw size={11} className="inline-block -mt-0.5" /> para buscar episódios novos pela API.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 bg-zinc-900/60 border border-zinc-800 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setVisibilityFilter("all")}
                      className={`px-2 py-1 rounded text-[11px] font-black transition ${visibilityFilter === "all" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibilityFilter("public")}
                      className={`px-2 py-1 rounded text-[11px] font-black transition ${visibilityFilter === "public" ? "bg-green-600 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                    >
                      Publicos
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibilityFilter("admin_only")}
                      className={`px-2 py-1 rounded text-[11px] font-black transition ${visibilityFilter === "admin_only" ? "bg-orange-600 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                    >
                      So admin
                    </button>
                  </div>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input value={animeSearch} onChange={e => setAnimeSearch(e.target.value)} placeholder="Buscar..." className="pl-8 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500 transition w-40" />
                  </div>
                  <button onClick={loadAnimes} className="text-zinc-500 hover:text-white transition p-2 hover:bg-zinc-800 rounded-lg"><RefreshCw size={16} /></button>
                </div>
              </div>
              <div className="space-y-2">
                {visibleFilteredAnimes.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-xl hover:bg-zinc-800 transition group">
                    {a.coverImage
                      ? <img src={a.coverImage} alt={a.title} className="w-10 h-14 object-cover rounded-lg shrink-0" />
                      : <div className="w-10 h-14 bg-zinc-700 rounded-lg shrink-0 flex items-center justify-center"><Film size={16} className="text-zinc-500" /></div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-white truncate">{a.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${a.visibility === "public" ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}`}>
                          {a.visibility === "public" ? "Público" : "Só Admin"}
                        </span>
                        <span className="text-xs text-zinc-500">{a.status === "ongoing" ? "Em Andamento" : "Completo"}</span>
                        {(a.categories || []).slice(0, 2).map((category) => (
                          <span key={`${a.id}-${category.id}`} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700/70 text-zinc-300 uppercase tracking-wide">
                            {category.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition">
                      <Link
                        href={`/anime/${a.id}`}
                        target="_blank"
                        className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-cyan-300 transition"
                        title="Abrir pagina do anime"
                      >
                        <ExternalLink size={16} />
                      </Link>
                      <button
                        onClick={() => handleSyncAnime(a)}
                        disabled={syncingAnimeId === a.id}
                        title="Atualizar episódios via API"
                        className="p-2 rounded-lg hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-300 transition disabled:opacity-50"
                      >
                        <RefreshCw size={16} className={syncingAnimeId === a.id ? "animate-spin" : ""} />
                      </button>
                      <button onClick={() => handleToggleVisibility(a)} title={a.visibility === "public" ? "Ocultar" : "Publicar"}
                        className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition">
                        {a.visibility === "public" ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <button onClick={() => {
                        setEditingAnime(a.id);
                        setAnimeForm({ title: a.title, description: a.description || "", coverImage: a.coverImage || "", bannerImage: a.bannerImage || "", status: a.status, visibility: a.visibility === "public" ? "public" : "admin_only" });
                        setAnimeCategoriesInput((a.categories || []).map((c) => c.name).join(", "));
                        setCoverPreview(a.coverImage || "");
                        setBannerPreview(a.bannerImage || "");
                        setAnimeMediaOptions([]);
                        setTab("animes");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }} className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-blue-400 transition">
                        <Edit3 size={16} />
                      </button>
                      <button onClick={() => handleDeleteAnime(a.id)} className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {visibleFilteredAnimes.length === 0 && <p className="text-zinc-500 text-sm text-center py-6">Nenhum anime encontrado.</p>}
              </div>
            </section>
          </div>
        )}

        {/* ── MANGAS TAB ── */}
        {tab === "mangas" && (
          <div className="space-y-6 animate-fadeInUp">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-lg">{editingManga ? "✏️ Editar Manga" : "➕ Adicionar Manga"}</h2>
                  {!editingManga && (
                    <Link href="/admin/manga-import" className="flex items-center gap-2 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-black transition border border-emerald-500/20">
                      <Download size={14} /> IMPORTAR MANGADEX
                    </Link>
                  )}
                </div>

                <form onSubmit={handleMangaSubmit} className="space-y-3">
                  <div>
                    <label className={labelClass}>Título *</label>
                    <input
                      required
                      className={inputClass}
                      value={mangaForm.title}
                      onChange={(e) => setMangaForm({ ...mangaForm, title: e.target.value })}
                      placeholder="Ex: Berserk"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Sinopse</label>
                    <textarea
                      className={inputClass + " min-h-[80px] resize-none"}
                      value={mangaForm.description}
                      onChange={(e) => setMangaForm({ ...mangaForm, description: e.target.value })}
                      placeholder="Descrição..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Capa (URL)</label>
                      <input
                        className={inputClass}
                        value={mangaForm.coverImage}
                        onChange={(e) => {
                          setMangaForm({ ...mangaForm, coverImage: e.target.value });
                          setMangaCoverPreview(e.target.value);
                        }}
                        placeholder="https://..."
                      />
                      <div className="mt-1">
                        <ImageUpload label="Upload imagem" onUpload={(url) => { setMangaForm({ ...mangaForm, coverImage: url }); setMangaCoverPreview(url); }} />
                      </div>
                      {mangaCoverPreview && <img src={mangaCoverPreview} alt="preview" className="mt-2 w-16 h-24 object-cover rounded-lg border border-zinc-700" />}
                    </div>
                    <div>
                      <label className={labelClass}>Banner (URL)</label>
                      <input
                        className={inputClass}
                        value={mangaForm.bannerImage}
                        onChange={(e) => {
                          setMangaForm({ ...mangaForm, bannerImage: e.target.value });
                          setMangaBannerPreview(e.target.value);
                        }}
                        placeholder="https://..."
                      />
                      <div className="mt-1">
                        <ImageUpload label="Upload imagem" onUpload={(url) => { setMangaForm({ ...mangaForm, bannerImage: url }); setMangaBannerPreview(url); }} />
                      </div>
                      {mangaBannerPreview && <img src={mangaBannerPreview} alt="preview" className="mt-2 w-full h-10 object-cover rounded-lg border border-zinc-700" />}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Categorias (separe por virgula)</label>
                    <input
                      className={inputClass}
                      value={mangaCategoriesInput}
                      onChange={(e) => setMangaCategoriesInput(e.target.value)}
                      placeholder="Ex: Ação, Drama, Horror"
                    />
                    {categories.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {categories.slice(0, 16).map((category) => (
                          <button
                            key={`m-${category.id}`}
                            type="button"
                            onClick={() => {
                              const current = mangaCategoriesInput
                                .split(",")
                                .map((part) => part.trim())
                                .filter(Boolean);
                              if (current.includes(category.name)) return;
                              setMangaCategoriesInput([...current, category.name].join(", "));
                            }}
                            className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold transition"
                          >
                            {category.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Status</label>
                      <select className={inputClass} value={mangaForm.status} onChange={(e) => setMangaForm({ ...mangaForm, status: e.target.value })}>
                        <option value="ongoing">Em andamento</option>
                        <option value="completed">Completo</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Visibilidade</label>
                      <select className={inputClass} value={mangaForm.visibility} onChange={(e) => setMangaForm({ ...mangaForm, visibility: e.target.value })}>
                        <option value="public">Público</option>
                        <option value="admin_only">Só admin</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2">
                      <Plus size={16} /> {editingManga ? "Atualizar" : "Salvar manga"}
                    </button>
                    {editingManga && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingManga(null);
                          setMangaForm({ title: "", description: "", coverImage: "", bannerImage: "", status: "ongoing", visibility: "public" });
                          setMangaCategoriesInput("");
                          setMangaCoverPreview("");
                          setMangaBannerPreview("");
                        }}
                        className="px-4 py-2.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-sm transition"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </form>
              </section>

              <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <div>
                    <h2 className="font-bold text-lg">Mangas ({mangas.length})</h2>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Sincronize capítulos e metadados pelo MangaDex.</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-zinc-900/60 border border-zinc-800 rounded-lg p-1">
                      <button type="button" onClick={() => setMangaVisibilityFilter("all")} className={`px-2 py-1 rounded text-[11px] font-black transition ${mangaVisibilityFilter === "all" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>Todos</button>
                      <button type="button" onClick={() => setMangaVisibilityFilter("public")} className={`px-2 py-1 rounded text-[11px] font-black transition ${mangaVisibilityFilter === "public" ? "bg-green-600 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>Públicos</button>
                      <button type="button" onClick={() => setMangaVisibilityFilter("admin_only")} className={`px-2 py-1 rounded text-[11px] font-black transition ${mangaVisibilityFilter === "admin_only" ? "bg-orange-600 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>Só admin</button>
                    </div>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input value={mangaSearch} onChange={(e) => setMangaSearch(e.target.value)} placeholder="Buscar..." className="pl-8 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 transition w-40" />
                    </div>
                    <button onClick={loadMangas} className="text-zinc-500 hover:text-white transition p-2 hover:bg-zinc-800 rounded-lg"><RefreshCw size={16} /></button>
                  </div>
                </div>

                <div className="mb-4 rounded-xl border border-zinc-700/60 bg-zinc-950/55 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 font-black">Sync rápido (mangás filtrados)</p>
                    <button
                      type="button"
                      onClick={handleSyncVisibleMangas}
                      disabled={syncingMangaBatch || visibleFilteredMangas.length === 0}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[11px] font-black inline-flex items-center gap-1.5"
                    >
                      {syncingMangaBatch ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      {syncingMangaBatch ? "Sincronizando lote..." : `Sincronizar ${visibleFilteredMangas.length}`}
                    </button>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-300">
                    <label className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={mangaSyncTranslatedOnly}
                        onChange={(e) => setMangaSyncTranslatedOnly(e.target.checked)}
                      />
                      PT/EN
                    </label>
                    <label className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={mangaSyncReplaceChapters}
                        onChange={(e) => setMangaSyncReplaceChapters(e.target.checked)}
                      />
                      Recriar capítulos
                    </label>
                    <label className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={mangaSyncEnrichMetadata}
                        onChange={(e) => setMangaSyncEnrichMetadata(e.target.checked)}
                      />
                      Enriquecer MAL
                    </label>
                    <label className="inline-flex items-center gap-1.5">
                      Visibilidade:
                      <select
                        value={mangaSyncVisibility}
                        onChange={(e) => setMangaSyncVisibility(e.target.value as "keep" | "public" | "admin_only")}
                        className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[11px]"
                      >
                        <option value="keep">Manter</option>
                        <option value="public">Publicar</option>
                        <option value="admin_only">Só admin</option>
                      </select>
                    </label>
                  </div>

                  {mangaBatchProgress && (
                    <p className="text-[11px] text-zinc-500">
                      Progresso: {mangaBatchProgress.done}/{mangaBatchProgress.total}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  {visibleFilteredMangas.map((manga) => (
                    <div key={manga.id} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-xl hover:bg-zinc-800 transition group">
                      {manga.coverImage
                        ? <img src={manga.coverImage} alt={manga.title} className="w-10 h-14 object-cover rounded-lg shrink-0" />
                        : <div className="w-10 h-14 bg-zinc-700 rounded-lg shrink-0 flex items-center justify-center"><BookOpen size={16} className="text-zinc-500" /></div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-white truncate">{manga.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${manga.visibility === "public" ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}`}>
                            {manga.visibility === "public" ? "Público" : "Só Admin"}
                          </span>
                          <span className="text-xs text-zinc-500">{(manga.chapters?.length || 0).toString()} cap.</span>
                          {manga.source && <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700/70 text-zinc-300 uppercase tracking-wide">{manga.source}</span>}
                          {(manga.malId || manga.malUrl) && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-200 uppercase tracking-wide">
                              MAL
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition">
                        <Link href={`/mangas/${manga.id}`} target="_blank" className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-cyan-300 transition" title="Abrir página do manga">
                          <ExternalLink size={16} />
                        </Link>
                        <button onClick={() => handleSyncManga(manga)} disabled={syncingMangaBatch || syncingMangaId === manga.id} title="Sincronizar capítulos" className="p-2 rounded-lg hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-300 transition disabled:opacity-50">
                          <RefreshCw size={16} className={syncingMangaId === manga.id ? "animate-spin" : ""} />
                        </button>
                        <button onClick={() => handleToggleMangaVisibility(manga)} title={manga.visibility === "public" ? "Ocultar" : "Publicar"} className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition">
                          {manga.visibility === "public" ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                        <button onClick={() => {
                          setEditingManga(manga.id);
                          setMangaForm({
                            title: manga.title,
                            description: manga.description || "",
                            coverImage: manga.coverImage || "",
                            bannerImage: manga.bannerImage || "",
                            status: manga.status,
                            visibility: manga.visibility,
                          });
                          setMangaCategoriesInput((manga.categories || []).map((c) => c.name).join(", "));
                          setMangaCoverPreview(manga.coverImage || "");
                          setMangaBannerPreview(manga.bannerImage || "");
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }} className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-blue-400 transition">
                          <Edit3 size={16} />
                        </button>
                        <button onClick={() => handleDeleteManga(manga.id)} className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {visibleFilteredMangas.length === 0 && <p className="text-zinc-500 text-sm text-center py-6">Nenhum manga encontrado.</p>}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ── BUGS TAB ── */}
        {tab === "bugs" && (
          <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-4 animate-fadeInUp">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-bold text-lg">Bugs reportados ({bugReports.length})</h2>
              <div className="flex items-center gap-2">
                <select
                  value={bugStatusFilter}
                  onChange={(e) => setBugStatusFilter(e.target.value as "all" | "open" | "investigating" | "resolved" | "closed")}
                  className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="all">Todos</option>
                  <option value="open">Abertos</option>
                  <option value="investigating">Investigando</option>
                  <option value="resolved">Resolvidos</option>
                  <option value="closed">Fechados</option>
                </select>
                <button onClick={loadBugReports} className="text-zinc-500 hover:text-white transition p-2 hover:bg-zinc-800 rounded-lg"><RefreshCw size={16} /></button>
              </div>
            </div>

            {filteredBugReports.length === 0 && <p className="text-zinc-500 text-sm text-center py-6">Nenhum bug report com esse filtro.</p>}

            <div className="space-y-3">
              {filteredBugReports.map((report) => (
                <div key={report.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-500 mb-1">
                        <img src={report.user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(report.user.name)}&background=333&color=fff`} alt={report.user.name} className="w-5 h-5 rounded-full" />
                        <span>{report.user.name}</span>
                        <span>• {report.user.email}</span>
                        <span>• {new Date(report.createdAt).toLocaleString("pt-BR")}</span>
                      </div>
                      <p className="font-bold text-white break-words">{report.title}</p>
                      <p className="text-sm text-zinc-300 mt-1 whitespace-pre-wrap break-words">{report.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                        {report.anime && <span className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-700">Anime: {report.anime.title}</span>}
                        {report.episode && <span className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-700">Episódio: T{report.episode.season || "?"}E{report.episode.number || "?"}</span>}
                        {report.pagePath && <span className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-700">Página: {report.pagePath}</span>}
                        {report.sourceUrl && report.sourceUrl.startsWith("http") && (
                          <a href={report.sourceUrl} target="_blank" rel="noreferrer" className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-700 hover:text-white transition">Fonte</a>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col gap-2 items-end">
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${report.status === "open" ? "bg-red-500/20 text-red-300" : report.status === "investigating" ? "bg-yellow-500/20 text-yellow-300" : report.status === "resolved" ? "bg-green-500/20 text-green-300" : "bg-zinc-700 text-zinc-300"}`}>
                        {report.status}
                      </span>
                      <button onClick={() => handleDeleteBug(report.id)} className="p-2 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 rounded-lg transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => handleBugStatus(report.id, "open")} className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold hover:bg-red-500/20 transition">Aberto</button>
                    <button onClick={() => handleBugStatus(report.id, "investigating")} className="px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-bold hover:bg-yellow-500/20 transition">Investigando</button>
                    <button onClick={() => handleBugStatus(report.id, "resolved")} className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 text-xs font-bold hover:bg-green-500/20 transition">Resolvido</button>
                    <button onClick={() => handleBugStatus(report.id, "closed")} className="px-3 py-1.5 rounded-lg bg-zinc-700 border border-zinc-600 text-zinc-200 text-xs font-bold hover:bg-zinc-600 transition">Fechado</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-4 animate-fadeInUp">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-bold text-lg">Usuários ({users.length})</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Online agora: <span className="text-emerald-300 font-bold">{onlineUsersMeta.onlineCount}</span></p>
              </div>
              <button onClick={loadUsers} className="text-zinc-500 hover:text-white transition p-2 hover:bg-zinc-800 rounded-lg"><RefreshCw size={16} /></button>
            </div>
            {onlineUsersMeta.onlineUsers.length > 0 && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Usuários online</p>
                <div className="flex flex-wrap gap-2">
                  {onlineUsersMeta.onlineUsers.map((onlineUser) => (
                    <span key={onlineUser.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {onlineUser.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-3">
              {users.map(u => {
                const timedOut = u.isTimedOut && new Date(u.isTimedOut) > new Date();
                const expanded = expandedUser === u.id;
                const onlineNow = Boolean(u.onlineNow);
                return (
                  <div key={u.id} className="bg-zinc-800/50 rounded-xl overflow-hidden border border-zinc-700/50">
                    <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-zinc-800 transition" onClick={() => setExpandedUser(expanded ? null : u.id)}>
                      <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 border-zinc-600">
                        <img src={u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=333&color=fff`} className="w-full h-full object-cover" alt={u.name} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm text-white truncate">{u.name}</p>
                          {u.role === "admin" && <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Shield size={10} /> Admin</span>}
                          {timedOut && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Clock size={10} /> Silenciado</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${onlineNow ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-700 text-zinc-300"}`}>
                            {onlineNow ? "Online" : "Offline"}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">{onlineNow ? "Ativo agora" : formatLastSeen(u.lastActiveAt)}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500 shrink-0">
                        <span>❤️ {u._count.favorites}</span>
                        <span>📺 {u._count.histories}</span>
                      </div>
                    </div>

                    {expanded && (
                      <div className="border-t border-zinc-700 p-4 space-y-4 bg-zinc-900/50">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div><label className={labelClass}>Nome</label><input className={inputClass} value={editUserForm[u.id]?.name || ""} onChange={e => setEditUserForm({ ...editUserForm, [u.id]: { ...editUserForm[u.id], name: e.target.value } })} /></div>
                          <div><label className={labelClass}>Email</label><input className={inputClass} value={editUserForm[u.id]?.email || ""} onChange={e => setEditUserForm({ ...editUserForm, [u.id]: { ...editUserForm[u.id], email: e.target.value } })} /></div>
                          <div>
                            <label className={labelClass}>Cargo</label>
                            <select className={inputClass} value={editUserForm[u.id]?.role || "user"} onChange={e => setEditUserForm({ ...editUserForm, [u.id]: { ...editUserForm[u.id], role: e.target.value } })}>
                              <option value="user">Usuário</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleEditUser(u.id)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition"><Check size={14} /> Salvar</button>
                        </div>

                        {/* Timeout */}
                        <div className="border-t border-zinc-700 pt-4">
                          <p className="text-xs font-bold text-zinc-400 mb-2 flex items-center gap-2"><Clock size={12} /> Moderação e punições</p>
                          {timedOut && <p className="text-xs text-red-400 mb-2">Silenciado até: {new Date(u.isTimedOut!).toLocaleString("pt-BR")}</p>}
                          <div className="flex items-center gap-2 flex-wrap">
                            <input type="datetime-local" className={inputClass + " flex-1 min-w-[180px]"}
                              value={timeoutForm[u.id] || ""}
                              onChange={e => setTimeoutForm({ ...timeoutForm, [u.id]: e.target.value })} />
                            <button onClick={() => handleTimeout(u.id)} className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold rounded-lg transition whitespace-nowrap">
                              Aplicar
                            </button>
                            {timedOut && (
                              <button onClick={() => handleRemoveTimeout(u.id)} className="px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-bold rounded-lg transition whitespace-nowrap">
                                Remover
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3">
                            <button onClick={() => applyTimeoutPreset(u.id, "1h")} className="px-2 py-2 rounded-lg bg-zinc-800 hover:bg-orange-500/20 text-zinc-300 hover:text-orange-300 text-xs font-bold transition">1h</button>
                            <button onClick={() => applyTimeoutPreset(u.id, "6h")} className="px-2 py-2 rounded-lg bg-zinc-800 hover:bg-orange-500/20 text-zinc-300 hover:text-orange-300 text-xs font-bold transition">6h</button>
                            <button onClick={() => applyTimeoutPreset(u.id, "24h")} className="px-2 py-2 rounded-lg bg-zinc-800 hover:bg-orange-500/20 text-zinc-300 hover:text-orange-300 text-xs font-bold transition">24h</button>
                            <button onClick={() => applyTimeoutPreset(u.id, "7d")} className="px-2 py-2 rounded-lg bg-zinc-800 hover:bg-orange-500/20 text-zinc-300 hover:text-orange-300 text-xs font-bold transition">7 dias</button>
                            <button onClick={() => applyTimeoutPreset(u.id, "30d")} className="px-2 py-2 rounded-lg bg-zinc-800 hover:bg-orange-500/20 text-zinc-300 hover:text-orange-300 text-xs font-bold transition">30 dias</button>
                            <button onClick={() => applyTimeoutPreset(u.id, "perm")} className="px-2 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold transition">Permanente</button>
                          </div>

                          <div className="mt-4 space-y-2">
                            <label className={labelClass}>Aviso direto ao usuário</label>
                            <div className="flex items-center gap-2">
                              <input
                                className={inputClass + " flex-1"}
                                value={warningForm[u.id] || ""}
                                onChange={(e) => setWarningForm({ ...warningForm, [u.id]: e.target.value })}
                                placeholder="Ex: Evite spam nos comentários."
                              />
                              <button
                                onClick={() => handleWarnUser(u.id)}
                                className="px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition whitespace-nowrap"
                              >
                                Enviar aviso
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Delete */}
                        <div className="border-t border-zinc-700 pt-4">
                          <button onClick={() => handleDeleteUser(u.id)} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-bold rounded-lg transition border border-red-500/30">
                            <Trash2 size={14} /> Deletar Usuário
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── SUGGESTIONS TAB ── */}
        {tab === "suggestions" && (
          <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-4 animate-fadeInUp">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Sugestões ({suggestions.length})</h2>
              <button onClick={loadSuggestions} className="text-zinc-500 hover:text-white transition p-2 hover:bg-zinc-800 rounded-lg"><RefreshCw size={16} /></button>
            </div>
            {suggestions.length === 0 && <p className="text-zinc-500 text-sm text-center py-6">Nenhuma sugestão ainda.</p>}
            <div className="space-y-3">
              {suggestions.map(s => (
                <div key={s.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <img src={s.user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.user.name)}&background=333&color=fff`} className="w-5 h-5 rounded-full shrink-0" alt={s.user.name} />
                        <span className="text-xs text-zinc-400">{s.user.name}</span>
                        <span className="text-xs text-zinc-600">• {new Date(s.createdAt).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <p className="font-bold text-white">{s.title}</p>
                      {s.description && <p className="text-sm text-zinc-400 mt-1 break-words">{s.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${s.status === "pending" ? "bg-yellow-500/20 text-yellow-400" : s.status === "accepted" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                        {s.status === "pending" ? "Pendente" : s.status === "accepted" ? "Aceito" : s.status === "reviewed" ? "Revisado" : "Rejeitado"}
                      </span>
                      <button onClick={() => handleDeleteSuggestion(s.id)} className="p-2 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 rounded-lg transition">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <button onClick={() => handleSuggestionStatus(s.id, "accepted")} className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 text-xs font-bold rounded-lg border border-green-500/30 transition"><Check size={12} /> Aceitar</button>
                    <button onClick={() => handleSuggestionStatus(s.id, "reviewed")} className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-xs font-bold rounded-lg border border-blue-500/30 transition"><MessageSquare size={12} /> Revisado</button>
                    <button onClick={() => handleSuggestionStatus(s.id, "rejected")} className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold rounded-lg border border-red-500/30 transition"><X size={12} /> Rejeitar</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── ANNOUNCEMENTS TAB ── */}
        {tab === "announcements" && (
          <div className="space-y-6 animate-fadeInUp">
            <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
              <h2 className="font-bold text-lg mb-4">📢 Novo Anúncio</h2>
              <form onSubmit={handleAnnSubmit} className="space-y-3">
                <div><label className={labelClass}>Título</label><input required className={inputClass} value={annForm.title} onChange={e => setAnnForm({ ...annForm, title: e.target.value })} placeholder="Ex: Nova atualização!" /></div>
                <div><label className={labelClass}>Mensagem</label><textarea required className={inputClass + " min-h-[100px] resize-y"} value={annForm.content} onChange={e => setAnnForm({ ...annForm, content: e.target.value })} placeholder="Conteúdo do anúncio..." /></div>
                <button type="submit" className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2.5 rounded-lg text-sm transition">
                  <Megaphone size={16} /> Publicar
                </button>
              </form>
            </section>
            <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg">Anúncios Publicados</h2>
                <button onClick={loadAnnouncements} className="text-zinc-500 hover:text-white transition p-2 hover:bg-zinc-800 rounded-lg"><RefreshCw size={16} /></button>
              </div>
              {announcements.length === 0 && <p className="text-zinc-500 text-sm">Nenhum anúncio ainda.</p>}
              {announcements.map(a => (
                <div key={a.id} className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white">{a.title}</p>
                      <p className="text-sm text-zinc-400 mt-1 whitespace-pre-wrap break-words">{a.content}</p>
                      <p className="text-xs text-zinc-600 mt-2">{new Date(a.createdAt).toLocaleString("pt-BR")}</p>
                    </div>
                    <button onClick={() => handleDeleteAnn(a.id)} className="p-2 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 rounded-lg transition shrink-0 mt-0.5">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
