"use client";

import AppLayout from "@/components/AppLayout";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Users, Film, MessageSquare, Megaphone, Plus, Trash2, Edit3,
  Clock, Eye, EyeOff, Check, X, UploadCloud, RefreshCw, Star,
  AlertTriangle, Search, Shield
} from "lucide-react";

type TabKey = "animes" | "users" | "suggestions" | "announcements";

interface User { id: string; name: string; email: string; role: string; avatarUrl?: string; isTimedOut?: string; _count: { favorites: number; histories: number } }
interface Anime { id: string; title: string; coverImage?: string; visibility: string; status: string; episodes?: { season: number }[] }
interface Suggestion { id: string; title: string; description?: string; status: string; user: { name: string; avatarUrl?: string }; createdAt: string }
interface Announcement { id: string; title: string; content: string; createdAt: string }

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
      <label className={`flex items-center gap-2 cursor-pointer text-xs font-bold transition ${uploading ? "text-zinc-500 cursor-not-allowed" : "text-pink-500 hover:text-pink-400"}`}>
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

interface EpItem { id: string; title: string; number: number; season: number; videoUrl?: string; }

function EpisodeManager({ animeId, animeName, showMsg, localFiles, localFolders, inputClass, labelClass }: {
  animeId: string; animeName: string;
  showMsg: (t: string, type?: "ok" | "err") => void;
  localFiles: { name: string; path: string; folder: string }[];
  localFolders: string[];
  inputClass: string; labelClass: string;
}) {
  const [episodes, setEpisodes] = useState<EpItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<EpItem>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/admin/episode?animeId=${animeId}`).then(r => r.json()).then(setEpisodes);
  }, [animeId]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (ep: EpItem) => {
    setEditingId(ep.id);
    setEditForm({ title: ep.title, number: ep.number, season: ep.season, videoUrl: ep.videoUrl || "" });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    const res = await fetch("/api/admin/episode", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingId, ...editForm }),
    });
    setSaving(false);
    if (res.ok) { showMsg("Episódio atualizado!"); setEditingId(null); load(); }
    else showMsg("Erro ao atualizar.", "err");
  };

  const deleteEp = async (id: string) => {
    setDeleting(id);
    const res = await fetch("/api/admin/episode", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setDeleting(null);
    if (res.ok) { showMsg("Episódio apagado."); load(); }
    else showMsg("Erro ao apagar.", "err");
  };

  if (episodes.length === 0) return (
    <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
      <p className="text-sm text-zinc-500">📋 Nenhum episódio em <span className="font-bold text-white">{animeName}</span> ainda.</p>
    </section>
  );

  return (
    <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-base flex items-center gap-2">
          📋 Episódios de <span className="text-pink-400">{animeName}</span>
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
                          className={`text-xs px-2 py-1 rounded border font-mono transition ${editForm.videoUrl === `/videos/${f.path}` ? "bg-green-600 border-green-500 text-white" : "bg-zinc-700 border-zinc-600 text-zinc-300 hover:border-pink-500"}`}>
                          🎬 {f.folder ? `${f.folder}/` : ""}{f.name}
                        </button>
                      ))}
                    </div>
                  )}
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
                <div className="w-9 h-9 bg-pink-600/20 border border-pink-500/20 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-pink-400 font-black text-sm">{ep.number}</span>
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
  const [users, setUsers] = useState<User[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");
  const [confirm, setConfirm] = useState<{ message: string; action: () => void } | null>(null);
  const [animeSearch, setAnimeSearch] = useState("");

  // Anime form
  const [animeForm, setAnimeForm] = useState({ title: "", description: "", coverImage: "", bannerImage: "", status: "ongoing" });
  const [editingAnime, setEditingAnime] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [bannerPreview, setBannerPreview] = useState("");
  // Ep form
  interface LocalFile { name: string; path: string; folder: string; }
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const [localFolders, setLocalFolders] = useState<string[]>([]);
  const [epForm, setEpForm] = useState({ animeId: "", number: "", season: "1", title: "", videoUrl: "" });
  // User forms
  const [timeoutForm, setTimeoutForm] = useState<{ [id: string]: string }>({});
  const [editUserForm, setEditUserForm] = useState<{ [id: string]: { name: string; email: string; role: string } }>({});
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  // Announcement form
  const [annForm, setAnnForm] = useState({ title: "", content: "" });

  const showMsg = (text: string, type: "ok" | "err" = "ok") => {
    setMsg(text); setMsgType(type);
    setTimeout(() => setMsg(""), 4000);
  };

  const askConfirm = (message: string, action: () => void) => setConfirm({ message, action });

  const loadAnimes = useCallback(() => fetch("/api/admin/anime").then(r => r.json()).then(setAnimes), []);
  const loadUsers = useCallback(() => fetch("/api/admin/users").then(r => r.json()).then(data => {
    setUsers(data);
    const forms: typeof editUserForm = {};
    data.forEach((u: User) => { forms[u.id] = { name: u.name, email: u.email, role: u.role }; });
    setEditUserForm(forms);
  }), []);
  const loadSuggestions = useCallback(() => fetch("/api/suggestions").then(r => r.json()).then(setSuggestions), []);
  const loadAnnouncements = useCallback(() => fetch("/api/announcements").then(r => r.json()).then(setAnnouncements), []);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/"); return; }
    // @ts-expect-error role
    if (status === "authenticated" && session?.user?.role !== "admin") { router.push("/"); return; }
    fetch("/api/local-files").then(r => r.json()).then(d => {
      setLocalFiles(d.files || []);
      setLocalFolders(d.folders || []);
    });
    loadAnimes(); loadUsers(); loadSuggestions(); loadAnnouncements();
  }, [status, session, router, loadAnimes, loadUsers, loadSuggestions, loadAnnouncements]);

  // @ts-expect-error role
  if (status === "loading" || session?.user?.role !== "admin") return null;

  const handleAnimeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingAnime ? "PUT" : "POST";
    const body = editingAnime ? { ...animeForm, id: editingAnime } : animeForm;
    const res = await fetch("/api/admin/anime", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      showMsg(editingAnime ? "Anime editado!" : "Anime adicionado ao catálogo!");
      setAnimeForm({ title: "", description: "", coverImage: "", bannerImage: "", status: "ongoing" });
      setCoverPreview(""); setBannerPreview("");
      setEditingAnime(null); loadAnimes();
    } else {
      const text = await res.text();
      showMsg(text || "Erro ao salvar.", "err");
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

  const handleTimeout = async (userId: string) => {
    const until = timeoutForm[userId] || null;
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
    loadSuggestions();
  };

  const handleDeleteSuggestion = (id: string) => {
    askConfirm("Apagar esta sugestão?", async () => {
      await fetch("/api/suggestions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      loadSuggestions(); setConfirm(null); showMsg("Sugestão removida.");
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

  const tabClass = (key: TabKey) =>
    `flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${tab === key ? "bg-pink-600 text-white shadow-[0_0_15px_rgba(255,0,127,0.3)]" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`;

  const inputClass = "w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-pink-500 transition";
  const labelClass = "text-xs font-bold text-zinc-400 mb-1 block";

  const filteredAnimes = animeSearch
    ? animes.filter(a => a.title.toLowerCase().includes(animeSearch.toLowerCase()))
    : animes;

  return (
    <AppLayout>
      {confirm && <ConfirmModal message={confirm.message} onConfirm={confirm.action} onCancel={() => setConfirm(null)} />}

      <div className="p-6 lg:p-10 pb-24 max-w-7xl mx-auto space-y-6">
        <div className="animate-fadeInUp">
          <h1 className="text-3xl font-black flex items-center gap-3">
            <span className="text-pink-500">Painel</span> Admin
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Gerencie o Futuro sem Contexto.</p>
        </div>

        {msg && (
          <div className={`p-3 rounded-xl text-sm font-bold border animate-fadeInUp ${msgType === "ok" ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}`}>
            {msg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          <button className={tabClass("animes")} onClick={() => setTab("animes")}><Film size={16} /> Animes</button>
          <button className={tabClass("users")} onClick={() => setTab("users")}><Users size={16} /> Usuários</button>
          <button className={tabClass("suggestions")} onClick={() => setTab("suggestions")}><Star size={16} /> Sugestões</button>
          <button className={tabClass("announcements")} onClick={() => setTab("announcements")}><Megaphone size={16} /> Anúncios</button>
        </div>

        {/* ── ANIMES TAB ── */}
        {tab === "animes" && (
          <div className="space-y-8 animate-fadeInUp">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Anime Form */}
              <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-4">
                <h2 className="font-bold text-lg">{editingAnime ? "✏️ Editar Anime" : "➕ Adicionar Anime"}</h2>
                <form onSubmit={handleAnimeSubmit} className="space-y-3">
                  <div>
                    <label className={labelClass}>Título *</label>
                    <input required className={inputClass} value={animeForm.title} onChange={e => setAnimeForm({ ...animeForm, title: e.target.value })} placeholder="Ex: Naruto Shippuden" />
                  </div>
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
                  <div>
                    <label className={labelClass}>Status</label>
                    <select className={inputClass} value={animeForm.status} onChange={e => setAnimeForm({ ...animeForm, status: e.target.value })}>
                      <option value="ongoing">Em Andamento</option>
                      <option value="completed">Completo</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-pink-600 hover:bg-pink-500 text-white font-bold py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2">
                      <Plus size={16} /> {editingAnime ? "Atualizar" : "Adicionar ao Catálogo"}
                    </button>
                    {editingAnime && (
                      <button type="button" onClick={() => { setEditingAnime(null); setAnimeForm({ title: "", description: "", coverImage: "", bannerImage: "", status: "ongoing" }); setCoverPreview(""); setBannerPreview(""); }}
                        className="px-4 py-2.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-sm transition">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </form>
              </section>

              {/* Episode Form */}
              <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-4">
                <h2 className="font-bold text-lg">🎬 Adicionar Episódio</h2>
                <form onSubmit={handleEpSubmit} className="space-y-3">
                  <div>
                    <label className={labelClass}>Anime</label>
                    <select required className={inputClass} value={epForm.animeId} onChange={e => setEpForm({ ...epForm, animeId: e.target.value })}>
                      <option value="">Selecione...</option>
                      {animes.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                    </select>
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
                        <p className="text-xs font-bold text-pink-400">📁 Arquivos em <code className="text-zinc-300">public/videos/</code> — clique para selecionar:</p>

                        {/* Root files */}
                        {localFiles.filter(f => !f.folder).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {localFiles.filter(f => !f.folder).map(f => (
                              <button key={f.path} type="button"
                                onClick={() => setEpForm(prev => ({ ...prev, videoUrl: `/videos/${f.path}` }))}
                                className={`text-xs px-3 py-1.5 rounded-lg border transition font-mono truncate max-w-[180px] ${
                                  epForm.videoUrl === `/videos/${f.path}`
                                    ? "bg-green-600 border-green-500 text-white"
                                    : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:border-pink-500"
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
                                      : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:border-pink-500"
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
                <EpisodeManager
                  animeId={epForm.animeId}
                  animeName={animes.find(a => a.id === epForm.animeId)?.title || ""}
                  showMsg={showMsg}
                  localFiles={localFiles}
                  localFolders={localFolders}
                  inputClass={inputClass}
                  labelClass={labelClass}
                />
              )}
            </div>

            {/* Anime List */}
            <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <h2 className="font-bold text-lg">Catálogo ({animes.length})</h2>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input value={animeSearch} onChange={e => setAnimeSearch(e.target.value)} placeholder="Buscar..." className="pl-8 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-pink-500 transition w-40" />
                  </div>
                  <button onClick={loadAnimes} className="text-zinc-500 hover:text-white transition p-2 hover:bg-zinc-800 rounded-lg"><RefreshCw size={16} /></button>
                </div>
              </div>
              <div className="space-y-2">
                {filteredAnimes.map((a) => (
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
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => handleToggleVisibility(a)} title={a.visibility === "public" ? "Ocultar" : "Publicar"}
                        className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition">
                        {a.visibility === "public" ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <button onClick={() => {
                        setEditingAnime(a.id);
                        setAnimeForm({ title: a.title, description: "", coverImage: a.coverImage || "", bannerImage: "", status: a.status });
                        setCoverPreview(a.coverImage || "");
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
                {filteredAnimes.length === 0 && <p className="text-zinc-500 text-sm text-center py-6">Nenhum anime encontrado.</p>}
              </div>
            </section>
          </div>
        )}

        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-4 animate-fadeInUp">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Usuários ({users.length})</h2>
              <button onClick={loadUsers} className="text-zinc-500 hover:text-white transition p-2 hover:bg-zinc-800 rounded-lg"><RefreshCw size={16} /></button>
            </div>
            <div className="space-y-3">
              {users.map(u => {
                const timedOut = u.isTimedOut && new Date(u.isTimedOut) > new Date();
                const expanded = expandedUser === u.id;
                return (
                  <div key={u.id} className="bg-zinc-800/50 rounded-xl overflow-hidden border border-zinc-700/50">
                    <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-zinc-800 transition" onClick={() => setExpandedUser(expanded ? null : u.id)}>
                      <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 border-zinc-600">
                        <img src={u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=333&color=fff`} className="w-full h-full object-cover" alt={u.name} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm text-white truncate">{u.name}</p>
                          {u.role === "admin" && <span className="text-xs bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Shield size={10} /> Admin</span>}
                          {timedOut && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Clock size={10} /> Silenciado</span>}
                        </div>
                        <p className="text-xs text-zinc-500 truncate">{u.email}</p>
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
                          <p className="text-xs font-bold text-zinc-400 mb-2 flex items-center gap-2"><Clock size={12} /> Punição (Timeout)</p>
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
                <button type="submit" className="flex items-center gap-2 bg-pink-600 hover:bg-pink-500 text-white font-bold px-6 py-2.5 rounded-lg text-sm transition">
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
