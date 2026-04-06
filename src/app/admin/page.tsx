"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Bug,
  ExternalLink,
  Lightbulb,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Save,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Users,
  Wand2,
} from "lucide-react";

import AppLayout from "@/components/AppLayout";
import SuggestionButton from "@/components/SuggestionButton";

type SectionKey = "overview" | "catalog" | "reports" | "suggestions" | "users" | "system";

type VisibilityType = "public" | "admin_only";
type StatusType = "ongoing" | "completed";

type AnimeRow = {
  id: string;
  title: string;
  description?: string | null;
  coverImage?: string | null;
  bannerImage?: string | null;
  visibility: VisibilityType;
  status: StatusType | string;
  categories?: { id: string; name: string }[];
};

type MetadataOption = {
  source?: "mal" | "find_my_anime" | string;
  sourceUrl?: string;
  malId?: number;
  malUrl?: string;
  matchedTitle?: string;
  coverImage?: string;
  bannerImage?: string;
  description?: string;
  categories?: string[];
  score?: number;
};

type BugReport = {
  id: string;
  title: string;
  description: string;
  status: "open" | "investigating" | "resolved" | "closed" | string;
  pagePath?: string | null;
  sourceUrl?: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
  anime?: { id: string; title: string } | null;
  episode?: { id: string; number?: number | null; season?: number | null; title?: string | null } | null;
};

type SuggestionRow = {
  id: string;
  title: string;
  description?: string | null;
  status: "pending" | "reviewed" | "accepted" | "rejected" | string;
  createdAt: string;
  user?: { id: string; name: string; avatarUrl?: string | null } | null;
};

type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | string;
  avatarUrl?: string | null;
  isTimedOut?: string | null;
  onlineNow?: boolean;
  _count?: {
    favorites?: number;
    histories?: number;
  };
};

type CategoryRow = { id: string; name: string };

type MessageState = { type: "ok" | "err"; text: string } | null;

const sectionConfig: Array<{ key: SectionKey; label: string; icon: React.ElementType }> = [
  { key: "overview", label: "Visao geral", icon: BarChart3 },
  { key: "catalog", label: "Catalogo anime", icon: Layers },
  { key: "reports", label: "Relatos de bug", icon: Bug },
  { key: "suggestions", label: "Sugestoes", icon: Lightbulb },
  { key: "users", label: "Usuarios", icon: Users },
  { key: "system", label: "Sistema", icon: Shield },
];

const bugStatuses = ["all", "open", "investigating", "resolved", "closed"] as const;
type BugFilterStatus = (typeof bugStatuses)[number];

const suggestionStatuses = ["all", "pending", "reviewed", "accepted", "rejected"] as const;
type SuggestionFilterStatus = (typeof suggestionStatuses)[number];

const bugStatusLabels: Record<string, string> = {
  all: "Todos",
  open: "Aberto",
  investigating: "Investigando",
  resolved: "Resolvido",
  closed: "Fechado",
};

const suggestionStatusLabels: Record<string, string> = {
  all: "Todas",
  pending: "Pendente",
  reviewed: "Revisada",
  accepted: "Aceita",
  rejected: "Recusada",
};

function formatAnimeStatus(status: string) {
  if (status === "ongoing") return "Em lançamento";
  if (status === "completed") return "Finalizado";
  return status || "Indefinido";
}

function formatVisibility(visibility: string) {
  if (visibility === "public") return "Público";
  if (visibility === "admin_only") return "Somente admin";
  return visibility || "Indefinida";
}

function createEmptyForm() {
  return {
    id: "",
    title: "",
    description: "",
    coverImage: "",
    bannerImage: "",
    status: "ongoing" as StatusType,
    visibility: "public" as VisibilityType,
    categoryNames: "",
  };
}

function parseCategoryInput(raw: string) {
  return Array.from(
    new Set(
      String(raw || "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  );
}

function categoryTextFromArray(values: string[]) {
  return parseCategoryInput(values.join(", ")).join(", ");
}

function sourceLabel(option: MetadataOption) {
  if (option.source === "find_my_anime") return "Find My Anime";
  if (option.source === "mal") return "MAL/Jikan";
  return "Meta source";
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAdmin = (session?.user as any)?.role === "admin";

  const [section, setSection] = useState<SectionKey>("overview");
  const [message, setMessage] = useState<MessageState>(null);
  const [loading, setLoading] = useState(true);

  const [animes, setAnimes] = useState<AnimeRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [bugFilter, setBugFilter] = useState<BugFilterStatus>("open");
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [suggestionFilter, setSuggestionFilter] = useState<SuggestionFilterStatus>("all");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [onlineUsersCount, setOnlineUsersCount] = useState(0);
  const [animeSearch, setAnimeSearch] = useState("");

  const [alerts, setAlerts] = useState({ openBugReportsCount: 0, pendingSuggestionsCount: 0 });

  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("Estamos em manutencao. Voltamos em breve.");
  const [animeTabEnabled, setAnimeTabEnabled] = useState(true);
  const [mangaTabEnabled, setMangaTabEnabled] = useState(false);

  const [animeForm, setAnimeForm] = useState(createEmptyForm());
  const [animeSaving, setAnimeSaving] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataOptions, setMetadataOptions] = useState<MetadataOption[]>([]);
  const [systemSaving, setSystemSaving] = useState(false);
  const [syncingAnimeId, setSyncingAnimeId] = useState<string | null>(null);

  const showMsg = useCallback((text: string, type: "ok" | "err" = "ok") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3500);
  }, []);

  const loadAnimes = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/anime", { cache: "no-store" });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setAnimes(Array.isArray(data) ? data : []);
    } catch {
      setAnimes([]);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/categories", { cache: "no-store" });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      const mapped = Array.isArray(data)
        ? data
            .map((row: any) => ({ id: String(row.id), name: String(row.name) }))
            .filter((row: CategoryRow) => row.id && row.name)
        : [];
      setCategories(mapped);
    } catch {
      setCategories([]);
    }
  }, []);

  const loadBugReports = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/bug-reports", { cache: "no-store" });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setBugReports(Array.isArray(data) ? data : []);
    } catch {
      setBugReports([]);
    }
  }, []);

  const loadSuggestions = useCallback(async () => {
    try {
      const response = await fetch("/api/suggestions", { cache: "no-store" });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setSuggestions(Array.isArray(data) ? data : []);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setUsers(Array.isArray(data?.users) ? data.users : []);
      setOnlineUsersCount(Number(data?.onlineCount || 0));
    } catch {
      setUsers([]);
      setOnlineUsersCount(0);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/alerts", { cache: "no-store" });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setAlerts({
        openBugReportsCount: Number(data?.openBugReportsCount || 0),
        pendingSuggestionsCount: Number(data?.pendingSuggestionsCount || 0),
      });
    } catch {
      setAlerts({ openBugReportsCount: 0, pendingSuggestionsCount: 0 });
    }
  }, []);

  const loadSystemState = useCallback(async () => {
    try {
      const [maintenanceResponse, navigationResponse] = await Promise.all([
        fetch("/api/admin/maintenance", { cache: "no-store" }),
        fetch("/api/admin/navigation", { cache: "no-store" }),
      ]);

      if (maintenanceResponse.ok) {
        const maintenance = await maintenanceResponse.json();
        setMaintenanceEnabled(Boolean(maintenance?.enabled));
        setMaintenanceMessage(String(maintenance?.message || "Estamos em manutencao. Voltamos em breve."));
      }

      if (navigationResponse.ok) {
        const navigation = await navigationResponse.json();
        setAnimeTabEnabled(Boolean(navigation?.animeTabEnabled));
        setMangaTabEnabled(Boolean(navigation?.mangaTabEnabled));
      }
    } catch {
      // keep local defaults
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadAnimes(),
      loadCategories(),
      loadBugReports(),
      loadSuggestions(),
      loadUsers(),
      loadAlerts(),
      loadSystemState(),
    ]);
    setLoading(false);
  }, [loadAlerts, loadAnimes, loadBugReports, loadCategories, loadSuggestions, loadSystemState, loadUsers]);

  useEffect(() => {
    if (status === "loading") return;
    if (!isAdmin) {
      router.replace("/");
      return;
    }
    void refreshDashboard();
  }, [status, isAdmin, router, refreshDashboard]);

  const resetAnimeForm = () => {
    setAnimeForm(createEmptyForm());
    setMetadataOptions([]);
  };

  const applyMetadataOption = (option: MetadataOption, overwriteExisting: boolean) => {
    setAnimeForm((current) => {
      const currentCategories = parseCategoryInput(current.categoryNames);
      const incomingCategories = parseCategoryInput((option.categories || []).join(", "));
      const mergedCategories = overwriteExisting
        ? incomingCategories
        : currentCategories.length > 0
          ? currentCategories
          : incomingCategories;

      return {
        ...current,
        description: overwriteExisting
          ? String(option.description || current.description)
          : current.description || String(option.description || ""),
        coverImage: overwriteExisting
          ? String(option.coverImage || current.coverImage)
          : current.coverImage || String(option.coverImage || ""),
        bannerImage: overwriteExisting
          ? String(option.bannerImage || option.coverImage || current.bannerImage)
          : current.bannerImage || String(option.bannerImage || option.coverImage || ""),
        categoryNames: mergedCategories.join(", "),
      };
    });
  };

  const handleFetchMetadata = async () => {
    const title = animeForm.title.trim();
    if (title.length < 2) {
      showMsg("Digite pelo menos 2 caracteres no titulo para buscar metadados.", "err");
      return;
    }

    setMetadataLoading(true);
    try {
      const response = await fetch(`/api/admin/anime/metadata?q=${encodeURIComponent(title)}&limit=12`);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMetadataOptions([]);
        showMsg(payload?.error || "Falha ao consultar metadados.", "err");
        return;
      }

      const options = Array.isArray(payload?.options)
        ? (payload.options as MetadataOption[])
        : payload?.media
          ? [payload.media as MetadataOption]
          : [];

      if (!options.length) {
        setMetadataOptions([]);
        showMsg("Nenhum resultado encontrado para esse titulo.", "err");
        return;
      }

      setMetadataOptions(options);
      applyMetadataOption(options[0], false);
      showMsg(`${options.length} opcao(oes) de metadados encontradas.`);
    } catch {
      setMetadataOptions([]);
      showMsg("Erro ao buscar metadados externos.", "err");
    } finally {
      setMetadataLoading(false);
    }
  };

  const handleSaveAnime = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = animeForm.title.trim();
    if (!title) {
      showMsg("Titulo obrigatorio.", "err");
      return;
    }

    setAnimeSaving(true);
    try {
      const payload = {
        id: animeForm.id || undefined,
        title,
        description: animeForm.description.trim(),
        coverImage: animeForm.coverImage.trim(),
        bannerImage: animeForm.bannerImage.trim(),
        status: animeForm.status,
        visibility: animeForm.visibility,
        categoryNames: parseCategoryInput(animeForm.categoryNames),
        autoMedia: true,
      };

      const response = await fetch("/api/admin/anime", {
        method: animeForm.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const raw = await response.text();
        let errorText = raw;
        try {
          const parsed = JSON.parse(raw);
          errorText = parsed?.error || parsed?.message || raw;
        } catch {
          // keep raw text
        }
        throw new Error(errorText || "Falha ao salvar anime.");
      }

      showMsg(animeForm.id ? "Anime atualizado com sucesso." : "Anime cadastrado com sucesso.");
      resetAnimeForm();
      await Promise.all([loadAnimes(), loadAlerts()]);
    } catch (error) {
      showMsg(error instanceof Error ? error.message : "Falha ao salvar anime.", "err");
    } finally {
      setAnimeSaving(false);
    }
  };

  const handleEditAnime = (anime: AnimeRow) => {
    setAnimeForm({
      id: anime.id,
      title: anime.title,
      description: anime.description || "",
      coverImage: anime.coverImage || "",
      bannerImage: anime.bannerImage || "",
      status: anime.status === "completed" ? "completed" : "ongoing",
      visibility: anime.visibility === "admin_only" ? "admin_only" : "public",
      categoryNames: (anime.categories || []).map((category) => category.name).join(", "),
    });
    setSection("catalog");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteAnime = async (id: string, title: string) => {
    if (!confirm(`Remover "${title}" do catalogo?`)) return;

    try {
      const response = await fetch("/api/admin/anime", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error("Falha ao remover anime.");
      showMsg("Anime removido.");
      await loadAnimes();
    } catch {
      showMsg("Erro ao remover anime.", "err");
    }
  };

  const handleToggleVisibility = async (anime: AnimeRow) => {
    try {
      const response = await fetch("/api/admin/anime", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: anime.id,
          visibility: anime.visibility === "public" ? "admin_only" : "public",
        }),
      });
      if (!response.ok) throw new Error("Falha ao alterar visibilidade.");
      await loadAnimes();
    } catch {
      showMsg("Falha ao alterar visibilidade.", "err");
    }
  };

  const handleSyncEpisodes = async (anime: AnimeRow) => {
    setSyncingAnimeId(anime.id);
    try {
      const response = await fetch("/api/admin/anime/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeId: anime.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao sincronizar episódios.");
      }

      const imported = Number(payload?.importedCount || 0);
      showMsg(imported > 0 ? `Sincronização concluída: ${imported} episódio(s) importado(s).` : "Sincronização concluída sem novos episódios.");
      await Promise.all([loadAnimes(), loadAlerts()]);
    } catch (error) {
      showMsg(error instanceof Error ? error.message : "Falha ao sincronizar episódios.", "err");
    } finally {
      setSyncingAnimeId(null);
    }
  };

  const handleUpdateBugStatus = async (id: string, nextStatus: string) => {
    try {
      const response = await fetch("/api/admin/bug-reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      if (!response.ok) throw new Error("Falha ao atualizar bug report.");
      await Promise.all([loadBugReports(), loadAlerts()]);
      showMsg("Status do bug atualizado.");
    } catch {
      showMsg("Nao foi possivel atualizar o bug report.", "err");
    }
  };

  const handleDeleteBugReport = async (id: string) => {
    if (!confirm("Remover esse bug report?")) return;
    try {
      const response = await fetch("/api/admin/bug-reports", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error("Falha ao remover bug report.");
      await Promise.all([loadBugReports(), loadAlerts()]);
      showMsg("Bug report removido.");
    } catch {
      showMsg("Erro ao remover bug report.", "err");
    }
  };

  const handleUpdateSuggestionStatus = async (id: string, nextStatus: string) => {
    try {
      const response = await fetch("/api/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      if (!response.ok) throw new Error("Falha ao atualizar sugestão.");
      await Promise.all([loadSuggestions(), loadAlerts()]);
      showMsg("Status da sugestão atualizado.");
    } catch {
      showMsg("Não foi possível atualizar a sugestão.", "err");
    }
  };

  const handleDeleteSuggestion = async (id: string) => {
    if (!confirm("Remover esta sugestão?")) return;
    try {
      const response = await fetch("/api/suggestions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error("Falha ao remover sugestão.");
      await Promise.all([loadSuggestions(), loadAlerts()]);
      showMsg("Sugestão removida.");
    } catch {
      showMsg("Erro ao remover sugestão.", "err");
    }
  };

  const handleToggleUserRole = async (user: AdminUserRow) => {
    const nextRole = user.role === "admin" ? "user" : "admin";
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, role: nextRole }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao atualizar role.");
      }
      await loadUsers();
      showMsg(`Role atualizada para ${nextRole === "admin" ? "admin" : "usuário"}.`);
    } catch (error) {
      showMsg(error instanceof Error ? error.message : "Não foi possível atualizar o usuário.", "err");
    }
  };

  const handleDeleteUser = async (user: AdminUserRow) => {
    if (!confirm(`Remover o usuário ${user.name}?`)) return;
    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao remover usuário.");
      }
      await loadUsers();
      showMsg("Usuário removido.");
    } catch (error) {
      showMsg(error instanceof Error ? error.message : "Erro ao remover usuário.", "err");
    }
  };

  const handleSaveSystem = async () => {
    setSystemSaving(true);
    try {
      const [maintenanceResponse, navigationResponse] = await Promise.all([
        fetch("/api/admin/maintenance", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: maintenanceEnabled, message: maintenanceMessage }),
        }),
        fetch("/api/admin/navigation", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ animeTabEnabled, mangaTabEnabled }),
        }),
      ]);

      if (!maintenanceResponse.ok || !navigationResponse.ok) {
        throw new Error("Falha ao salvar configuracoes de sistema.");
      }

      showMsg("Configuracoes de sistema salvas.");
      await loadAlerts();
    } catch {
      showMsg("Nao foi possivel salvar configuracoes de sistema.", "err");
    } finally {
      setSystemSaving(false);
    }
  };

  const filteredAnimes = useMemo(() => {
    const query = animeSearch.trim().toLowerCase();
    if (!query) return animes;
    return animes.filter((anime) => anime.title.toLowerCase().includes(query));
  }, [animes, animeSearch]);

  const filteredBugReports = useMemo(() => {
    if (bugFilter === "all") return bugReports;
    return bugReports.filter((bug) => bug.status === bugFilter);
  }, [bugFilter, bugReports]);

  const filteredSuggestions = useMemo(() => {
    if (suggestionFilter === "all") return suggestions;
    return suggestions.filter((suggestion) => suggestion.status === suggestionFilter);
  }, [suggestionFilter, suggestions]);

  const openBugCount =
    bugReports.length > 0
      ? bugReports.filter((bug) => bug.status === "open").length
      : alerts.openBugReportsCount;

  if (status === "loading" || !isAdmin) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center text-zinc-400">
          <div className="flex items-center gap-3 text-sm font-bold">
            <Loader2 size={16} className="animate-spin" /> Carregando painel admin...
          </div>
        </div>
      </AppLayout>
    );
  }

  const coverPreview = animeForm.coverImage.trim() || "/logo.png";
  const bannerPreview = animeForm.bannerImage.trim() || animeForm.coverImage.trim() || "/logo.png";

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 pb-24 max-w-7xl mx-auto space-y-5">
        <section className="rounded-3xl border border-white/12 bg-gradient-to-br from-black/60 via-black/40 to-black/20 backdrop-blur-xl p-5 lg:p-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] font-black text-[var(--text-muted)]">Admin workspace 2.0</p>
              <h1 className="text-3xl lg:text-4xl font-black mt-2 text-white">Painel totalmente novo</h1>
              <p className="text-sm text-zinc-300 mt-2 max-w-3xl">
                Fluxo focado em catalogo de anime com metadados completos (sinopse, categorias, capa e banner), bug triage e controles do sistema.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void refreshDashboard()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold text-sm transition"
              >
                <RefreshCw size={15} /> Atualizar tudo
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!confirm("Isso consultará a API para TODOS os animes em andamento. Deseja continuar?")) return;
                  try {
                    showMsg("Sincronização em massa iniciada...");
                    // We call the same sync endpoint without ID or a dedicated one
                    const res = await fetch("/api/admin/anime/sync", { method: "POST" });
                    if (!res.ok) throw new Error("Falha na sincronização.");
                    showMsg("Sincronização em massa concluída com sucesso.");
                    refreshDashboard();
                  } catch (e) {
                    showMsg("Erro ao sincronizar todos os animes.", "err");
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-100 font-bold text-sm transition"
              >
                <RefreshCw size={15} /> Sincronizar TODOS
              </button>
              <Link
                href="/admin/import"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold text-sm transition"
              >
                <Plus size={15} /> Importar episódios
              </Link>
            </div>
          </div>
        </section>

        {message && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-bold ${
              message.type === "ok"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                : "border-red-400/30 bg-red-400/10 text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[220px_1fr] gap-4">
          <aside className="rounded-2xl border border-white/10 bg-black/25 p-2 h-fit mb-4 xl:mb-0 overflow-x-auto w-full kdr-hide-scrollbar">
            <nav className="flex xl:flex-col gap-1 w-max xl:w-full">
              {sectionConfig.map((item) => {
                const Icon = item.icon;
                const active = section === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSection(item.key)}
                    className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 xl:w-full text-sm font-bold transition whitespace-nowrap ${
                      active
                        ? "bg-white text-black"
                        : "text-zinc-300 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <Icon size={16} className="shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="space-y-4">
            {section === "overview" && (
              <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 font-black">Animes no catalogo</p>
                  <p className="text-3xl font-black text-white mt-1">{animes.length}</p>
                </article>
                <article className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-red-200 font-black">Bugs em aberto</p>
                  <p className="text-3xl font-black text-white mt-1">{openBugCount}</p>
                </article>
                <article className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-amber-200 font-black">Sugestoes pendentes</p>
                  <p className="text-3xl font-black text-white mt-1">{alerts.pendingSuggestionsCount}</p>
                </article>
                <article className="rounded-2xl border border-sky-300/25 bg-sky-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-sky-200 font-black">Usuarios online</p>
                  <p className="text-3xl font-black text-white mt-1">{onlineUsersCount}</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 font-black">Categorias</p>
                  <p className="text-3xl font-black text-white mt-1">{categories.length}</p>
                </article>

                <article className="md:col-span-2 xl:col-span-5 rounded-2xl border border-white/10 bg-black/25 p-4 lg:p-5">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSection("catalog")}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-100 text-sm font-bold"
                    >
                      <Sparkles size={14} /> Abrir editor de catalogo
                    </button>
                    <button
                      type="button"
                      onClick={() => setSection("reports")}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-100 text-sm font-bold"
                    >
                      <Bug size={14} /> Revisar bug reports
                    </button>
                    <button
                      type="button"
                      onClick={() => setSection("suggestions")}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-100 text-sm font-bold"
                    >
                      <Lightbulb size={14} /> Ver sugestões
                    </button>
                    <button
                      type="button"
                      onClick={() => setSection("users")}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-100 text-sm font-bold"
                    >
                      <Users size={14} /> Gerenciar usuários
                    </button>
                    <Link
                      href="/admin/manga-import"
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-100 text-sm font-bold"
                    >
                      <Layers size={14} /> Importar mangas
                    </Link>
                    <button
                      type="button"
                      onClick={() => setSection("system")}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-100 text-sm font-bold"
                    >
                      <Power size={14} /> Ajustes do sistema
                    </button>
                  </div>
                </article>
              </section>
            )}

            {section === "catalog" && (
              <section className="grid grid-cols-1 2xl:grid-cols-[1.15fr_1fr] gap-4">
                <article className="rounded-2xl border border-white/10 bg-black/25 p-4 lg:p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-white font-black text-lg">
                      {animeForm.id ? "Editar anime" : "Novo anime"}
                    </h2>
                    {animeForm.id && (
                      <button
                        type="button"
                        onClick={resetAnimeForm}
                        className="text-xs font-bold text-zinc-400 hover:text-white transition"
                      >
                        Limpar formulario
                      </button>
                    )}
                  </div>

                  <form className="space-y-3" onSubmit={handleSaveAnime}>
                    <div>
                      <label className="text-xs uppercase tracking-wider font-bold text-zinc-400">Titulo</label>
                      <div className="mt-1 flex gap-2">
                        <input
                          value={animeForm.title}
                          onChange={(event) => setAnimeForm((current) => ({ ...current, title: event.target.value }))}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/35"
                          placeholder="Nome do anime"
                        />
                        <button
                          type="button"
                          onClick={handleFetchMetadata}
                          disabled={metadataLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-black font-black text-xs hover:bg-zinc-100 disabled:opacity-60"
                        >
                          {metadataLoading ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                          Meta
                        </button>
                      </div>
                    </div>

                    {metadataOptions.length > 0 && (
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
                        <p className="text-xs font-black uppercase tracking-wider text-zinc-400">Resultados de metadados</p>
                        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                          {metadataOptions.map((option, index) => (
                            <div
                              key={`${option.source || "src"}-${option.matchedTitle || "item"}-${index}`}
                              className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-2.5 flex items-start gap-2.5"
                            >
                              <img
                                src={option.coverImage || option.bannerImage || "/logo.png"}
                                alt={option.matchedTitle || `resultado-${index + 1}`}
                                className="w-10 h-14 rounded object-cover shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-white truncate">{option.matchedTitle || `Resultado ${index + 1}`}</p>
                                <p className="text-[11px] text-zinc-400 mt-0.5">
                                  {sourceLabel(option)}
                                  {typeof option.score === "number" ? ` · score ${option.score.toFixed(1)}` : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    applyMetadataOption(option, true);
                                    showMsg("Metadados aplicados ao formulario.");
                                  }}
                                  className="px-2 py-1 rounded-md text-[11px] font-bold bg-white text-black hover:bg-zinc-100"
                                >
                                  Aplicar
                                </button>
                                {(option.sourceUrl || option.malUrl) && (
                                  <a
                                    href={option.sourceUrl || option.malUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded-md border border-zinc-600 text-zinc-300 hover:text-white hover:border-zinc-400"
                                    title="Abrir fonte"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-xs uppercase tracking-wider font-bold text-zinc-400">Sinopse</label>
                      <textarea
                        value={animeForm.description}
                        onChange={(event) => setAnimeForm((current) => ({ ...current, description: event.target.value }))}
                        className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/35 min-h-[96px]"
                        placeholder="Sinopse do anime"
                      />
                    </div>

                    <div>
                      <label className="text-xs uppercase tracking-wider font-bold text-zinc-400">Categorias (separadas por virgula)</label>
                      <input
                        value={animeForm.categoryNames}
                        onChange={(event) => setAnimeForm((current) => ({ ...current, categoryNames: event.target.value }))}
                        className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/35"
                        placeholder="acao, aventura, drama"
                      />
                      {categories.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {categories.slice(0, 16).map((category) => (
                            <button
                              key={category.id}
                              type="button"
                              onClick={() => {
                                const merged = parseCategoryInput(`${animeForm.categoryNames}, ${category.name}`);
                                setAnimeForm((current) => ({ ...current, categoryNames: merged.join(", ") }));
                              }}
                              className="px-2 py-1 rounded-full text-[11px] font-semibold border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500"
                            >
                              + {category.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs uppercase tracking-wider font-bold text-zinc-400">Status</label>
                        <select
                          value={animeForm.status}
                          onChange={(event) => setAnimeForm((current) => ({ ...current, status: event.target.value as StatusType }))}
                          className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/35"
                        >
                          <option value="ongoing">Em lançamento</option>
                          <option value="completed">Finalizado</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-wider font-bold text-zinc-400">Visibilidade</label>
                        <select
                          value={animeForm.visibility}
                          onChange={(event) => setAnimeForm((current) => ({ ...current, visibility: event.target.value as VisibilityType }))}
                          className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/35"
                        >
                          <option value="public">Publico</option>
                          <option value="admin_only">Somente admin</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs uppercase tracking-wider font-bold text-zinc-400">Capa (cover image)</label>
                      <input
                        value={animeForm.coverImage}
                        onChange={(event) => setAnimeForm((current) => ({ ...current, coverImage: event.target.value }))}
                        className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                        placeholder="https://..."
                      />
                    </div>

                    <div>
                      <label className="text-xs uppercase tracking-wider font-bold text-zinc-400">Banner (hero image)</label>
                      <input
                        value={animeForm.bannerImage}
                        onChange={(event) => setAnimeForm((current) => ({ ...current, bannerImage: event.target.value }))}
                        className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                        placeholder="https://..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-2">
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-black mb-2">Preview capa</p>
                        <img src={coverPreview} alt="preview capa" className="w-full aspect-[2/3] object-cover rounded-md" />
                      </div>
                      <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-2">
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-black mb-2">Preview banner</p>
                        <img src={bannerPreview} alt="preview banner" className="w-full aspect-[16/9] object-cover rounded-md" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={animeSaving}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black font-black text-sm hover:bg-zinc-100 disabled:opacity-60"
                      >
                        {animeSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        {animeForm.id ? "Atualizar anime" : "Cadastrar anime"}
                      </button>
                      <button
                        type="button"
                        onClick={resetAnimeForm}
                        className="px-3 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-sm font-bold"
                      >
                        Resetar
                      </button>
                    </div>
                  </form>
                </article>

                <article className="rounded-2xl border border-white/10 bg-black/25 p-4 lg:p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h2 className="text-white font-black text-lg">Animes cadastrados</h2>
                    <div className="relative w-full max-w-xs">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        value={animeSearch}
                        onChange={(event) => setAnimeSearch(event.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:border-white/35"
                        placeholder="Filtrar por titulo"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[72vh] overflow-y-auto pr-1">
                    {loading ? (
                      <p className="text-zinc-500 text-sm">Carregando catalogo...</p>
                    ) : filteredAnimes.length === 0 ? (
                      <p className="text-zinc-500 text-sm">Nenhum anime encontrado.</p>
                    ) : (
                      filteredAnimes.map((anime) => (
                        <div key={anime.id} className="rounded-xl border border-zinc-800 bg-zinc-950/65 p-3">
                          <div className="flex items-start gap-3">
                            <img
                              src={anime.coverImage || anime.bannerImage || "/logo.png"}
                              alt={anime.title}
                              className="w-12 h-16 rounded object-cover shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-black text-white truncate">{anime.title}</p>
                              <p className="text-[11px] text-zinc-400 mt-0.5">
                                {formatAnimeStatus(anime.status || "ongoing")} · {formatVisibility(anime.visibility)}
                              </p>
                              {(anime.categories || []).length > 0 && (
                                <p className="text-[11px] text-zinc-500 mt-1 truncate">
                                  {(anime.categories || []).slice(0, 3).map((category) => category.name).join(", ")}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-3">
                            <button
                              type="button"
                              onClick={() => handleEditAnime(anime)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-zinc-700 text-zinc-200 hover:text-white hover:border-zinc-500"
                            >
                              <Pencil size={12} /> Editar
                            </button>
                            <Link
                              href={`/anime/${anime.id}`}
                              target="_blank"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-zinc-700 text-cyan-200 hover:text-cyan-100 hover:bg-cyan-500/10"
                            >
                              <ExternalLink size={12} /> Ver Anime
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleToggleVisibility(anime)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-zinc-700 text-zinc-200 hover:text-white hover:border-zinc-500"
                            >
                              {anime.visibility === "public" ? "Somente admin" : "Tornar público"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSyncEpisodes(anime)}
                              disabled={syncingAnimeId === anime.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-blue-500/40 text-blue-200 hover:text-blue-100 hover:bg-blue-500/15 disabled:opacity-60"
                            >
                              {syncingAnimeId === anime.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                              Atualizar episódios
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAnime(anime.id, anime.title)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-red-500/40 text-red-300 hover:text-red-200 hover:bg-red-500/10"
                            >
                              <Trash2 size={12} /> Excluir
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </article>
              </section>
            )}

            {section === "reports" && (
              <section className="rounded-2xl border border-white/10 bg-black/25 p-4 lg:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-white font-black text-lg">Relatos de bug</h2>
                  <div className="flex items-center gap-2">
                    {bugStatuses.map((statusValue) => (
                      <button
                        key={statusValue}
                        type="button"
                        onClick={() => setBugFilter(statusValue)}
                        className={`px-2.5 py-1.5 rounded-full text-xs font-black border transition ${
                          bugFilter === statusValue
                            ? "bg-white text-black border-white"
                            : "border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500"
                        }`}
                      >
                        {bugStatusLabels[statusValue] || statusValue}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 max-h-[74vh] overflow-y-auto pr-1">
                  {filteredBugReports.length === 0 ? (
                    <p className="text-sm text-zinc-500">Nenhum bug report para o filtro atual.</p>
                  ) : (
                    filteredBugReports.map((report) => (
                      <article key={report.id} className="rounded-xl border border-zinc-800 bg-zinc-950/65 p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-white">{report.title}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {report.user?.name || "Usuario"} · {new Date(report.createdAt).toLocaleString("pt-BR")}
                            </p>
                          </div>
                          <select
                            value={report.status}
                            onChange={(event) => void handleUpdateBugStatus(report.id, event.target.value)}
                            className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                          >
                            <option value="open">Aberto</option>
                            <option value="investigating">Investigando</option>
                            <option value="resolved">Resolvido</option>
                            <option value="closed">Fechado</option>
                          </select>
                        </div>

                        <p className="text-sm text-zinc-200 mt-2 whitespace-pre-wrap">{report.description}</p>

                        <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] text-zinc-400">
                          {report.anime?.title && <span className="px-2 py-1 rounded-full border border-zinc-700">Anime: {report.anime.title}</span>}
                          {report.episode && (
                            <span className="px-2 py-1 rounded-full border border-zinc-700">
                              Ep: T{report.episode.season || "?"}E{report.episode.number || "?"}
                            </span>
                          )}
                          {report.pagePath && <span className="px-2 py-1 rounded-full border border-zinc-700">Path: {report.pagePath}</span>}
                          {report.sourceUrl && (
                            <a
                              href={report.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-zinc-700 hover:text-white hover:border-zinc-500"
                            >
                              Fonte <ExternalLink size={11} />
                            </a>
                          )}
                        </div>

                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => void handleDeleteBugReport(report.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-red-500/40 text-red-300 hover:text-red-200 hover:bg-red-500/10"
                          >
                            <Trash2 size={12} /> Remover report
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            )}

            {section === "suggestions" && (
              <section className="rounded-2xl border border-white/10 bg-black/25 p-4 lg:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-white font-black text-lg">Sugestões dos usuários</h2>
                  <div className="flex items-center gap-2">
                    {suggestionStatuses.map((statusValue) => (
                      <button
                        key={statusValue}
                        type="button"
                        onClick={() => setSuggestionFilter(statusValue)}
                        className={`px-2.5 py-1.5 rounded-full text-xs font-black border transition ${
                          suggestionFilter === statusValue
                            ? "bg-white text-black border-white"
                            : "border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500"
                        }`}
                      >
                        {suggestionStatusLabels[statusValue] || statusValue}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 max-h-[74vh] overflow-y-auto pr-1">
                  {filteredSuggestions.length === 0 ? (
                    <p className="text-sm text-zinc-500">Nenhuma sugestão para o filtro atual.</p>
                  ) : (
                    filteredSuggestions.map((suggestion) => (
                      <article key={suggestion.id} className="rounded-xl border border-zinc-800 bg-zinc-950/65 p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-white">{suggestion.title}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {suggestion.user?.name || "Usuário"} · {new Date(suggestion.createdAt).toLocaleString("pt-BR")}
                            </p>
                          </div>
                          <select
                            value={suggestion.status}
                            onChange={(event) => void handleUpdateSuggestionStatus(suggestion.id, event.target.value)}
                            className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                          >
                            <option value="pending">Pendente</option>
                            <option value="reviewed">Revisada</option>
                            <option value="accepted">Aceita</option>
                            <option value="rejected">Recusada</option>
                          </select>
                        </div>

                        <p className="text-sm text-zinc-200 mt-2 whitespace-pre-wrap">
                          {suggestion.description?.trim() || "Sem descrição."}
                        </p>

                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => void handleDeleteSuggestion(suggestion.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-red-500/40 text-red-300 hover:text-red-200 hover:bg-red-500/10"
                          >
                            <Trash2 size={12} /> Remover sugestão
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            )}

            {section === "users" && (
              <section className="rounded-2xl border border-white/10 bg-black/25 p-4 lg:p-5 space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-white font-black text-lg">Usuários</h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      {users.length} conta(s) · {onlineUsersCount} online agora
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadUsers()}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-100 text-sm font-bold"
                  >
                    <RefreshCw size={14} /> Atualizar usuários
                  </button>
                </div>

                <div className="space-y-2 max-h-[74vh] overflow-y-auto pr-1">
                  {users.length === 0 ? (
                    <p className="text-sm text-zinc-500">Nenhum usuário encontrado.</p>
                  ) : (
                    users.map((user) => (
                      <article key={user.id} className="rounded-xl border border-zinc-800 bg-zinc-950/65 p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex items-start gap-3">
                            <img
                              src={user.avatarUrl || "/default-avatar.png"}
                              alt={user.name}
                              className="w-11 h-11 rounded-full object-cover border border-zinc-700 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-black text-white truncate">{user.name}</p>
                              <p className="text-xs text-zinc-400 truncate">{user.email}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                                <span className="px-2 py-0.5 rounded-full border border-zinc-700">
                                  Role: {user.role === "admin" ? "Admin" : "Usuário"}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full border ${user.onlineNow ? "border-emerald-500/50 text-emerald-300" : "border-zinc-700 text-zinc-400"}`}>
                                  {user.onlineNow ? "Online" : "Offline"}
                                </span>
                                {user.isTimedOut ? (
                                  <span className="px-2 py-0.5 rounded-full border border-amber-400/40 text-amber-300">
                                    Suspenso até {new Date(user.isTimedOut).toLocaleString("pt-BR")}
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-[11px] text-zinc-500 mt-1">
                                Favoritos: {Number(user._count?.favorites || 0)} · Histórico: {Number(user._count?.histories || 0)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleToggleUserRole(user)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-zinc-700 text-zinc-200 hover:text-white hover:border-zinc-500"
                            >
                              {user.role === "admin" ? "Virar usuário" : "Virar admin"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteUser(user)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-red-500/40 text-red-300 hover:text-red-200 hover:bg-red-500/10"
                            >
                              <Trash2 size={12} /> Remover
                            </button>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            )}

            {section === "system" && (
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <article className="rounded-2xl border border-white/10 bg-black/25 p-4 lg:p-5 space-y-3">
                  <h2 className="text-white font-black text-lg flex items-center gap-2">
                    <Power size={17} className="text-amber-300" /> Manutencao
                  </h2>
                  <label className="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900/55 px-3 py-2.5">
                    <span className="text-sm font-semibold text-zinc-200">Ativar modo manutencao</span>
                    <input
                      type="checkbox"
                      checked={maintenanceEnabled}
                      onChange={(event) => setMaintenanceEnabled(event.target.checked)}
                    />
                  </label>
                  <textarea
                    value={maintenanceMessage}
                    onChange={(event) => setMaintenanceMessage(event.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-500 min-h-[92px]"
                    placeholder="Mensagem de manutencao"
                  />
                </article>

                <article className="rounded-2xl border border-white/10 bg-black/25 p-4 lg:p-5 space-y-3">
                  <h2 className="text-white font-black text-lg flex items-center gap-2">
                    <Shield size={17} className="text-emerald-300" /> Abas para usuarios
                  </h2>
                  <label className="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900/55 px-3 py-2.5">
                    <span className="text-sm font-semibold text-zinc-200">Aba Anime</span>
                    <input
                      type="checkbox"
                      checked={animeTabEnabled}
                      onChange={(event) => setAnimeTabEnabled(event.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900/55 px-3 py-2.5">
                    <span className="text-sm font-semibold text-zinc-200">Aba Manga</span>
                    <input
                      type="checkbox"
                      checked={mangaTabEnabled}
                      onChange={(event) => setMangaTabEnabled(event.target.checked)}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleSaveSystem}
                    disabled={systemSaving}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black font-black text-sm hover:bg-zinc-100 disabled:opacity-60"
                  >
                    {systemSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    Salvar sistema
                  </button>
                </article>

                <article className="lg:col-span-2 rounded-2xl border border-white/10 bg-black/25 p-4 lg:p-5 space-y-3">
                  <h2 className="text-white font-black text-lg flex items-center gap-2">
                    <AlertTriangle size={17} className="text-cyan-300" /> Atalho de reportar bug
                  </h2>
                  <p className="text-sm text-zinc-400 max-w-3xl">
                    Use este atalho para abrir o formulário de bug sem sair do painel. O mesmo atalho também aparece no menu da foto de perfil para usuários.
                  </p>
                  <SuggestionButton
                    variant="sidebar"
                    mobileSidebar={true}
                    forceVisible={true}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-zinc-100 font-semibold hover:bg-white/10 transition"
                  />
                </article>
              </section>
            )}
          </main>
        </div>
      </div>
    </AppLayout>
  );
}
