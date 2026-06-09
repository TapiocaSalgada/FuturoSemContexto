"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Filter, Search, SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "next/navigation";

import type { CatalogItem } from "@/lib/catalog/types";
import CatalogCard from "@/components/catalog/CatalogCard";
import EmptyState from "@/components/catalog/EmptyState";

type SearchPayload = {
  items?: CatalogItem[];
  animes?: CatalogItem[];
  hasMore?: boolean;
  nextOffset?: number | null;
  hint?: string;
};

type ExploreClientProps = {
  initialItems: CatalogItem[];
  title?: string;
  searchFirst?: boolean;
};

const tabs = [
  { key: "todos", label: "Todos" },
  { key: "dublados", label: "Dublados" },
  { key: "legendados", label: "Legendados" },
  { key: "populares", label: "Populares" },
  { key: "lancamentos", label: "Lançamentos" },
];

function normalize(value: unknown) {
  return String(value || "").toLowerCase();
}

export default function ExploreClient({ initialItems, title = "Explorar", searchFirst = false }: ExploreClientProps) {
  const searchParams = useSearchParams();
  const initialTab = tabs.some((tab) => tab.key === searchParams.get("tab")) ? String(searchParams.get("tab")) : "todos";
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState(initialTab);
  const [kind, setKind] = useState("all");
  const [items, setItems] = useState<CatalogItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runSearch(value: string) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ users: "1", limit: "80" });
      if (value.trim()) params.set("q", value.trim());
      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) throw new Error("search failed");
      const payload = (await response.json()) as SearchPayload;
      setItems(payload.items || payload.animes || []);
    } catch {
      setError("Não foi possível buscar agora.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => runSearch(query), 260);
    return () => window.clearTimeout(timer);
  }, [query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runSearch(query);
  }

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (kind !== "all" && normalize(item.kind) !== kind) return false;
      const language = normalize(item.language);
      if (activeTab === "dublados" && !language.includes("dub") && !language.includes("ambos")) return false;
      if (activeTab === "legendados" && !language.includes("leg") && !language.includes("sub") && !language.includes("ambos")) return false;
      if (activeTab === "populares") return item.episodeCount > 0 || item.isFeatured;
      if (activeTab === "lancamentos") return item.episodeCount > 0;
      return true;
    });
  }, [activeTab, items, kind]);

  return (
    <div className={searchFirst ? "stack-page search-screen" : "stack-page"}>
      <section className="compact-hero browse-hero">
        <p className="eyebrow">{title}</p>
        <h1>{searchFirst ? "Buscar anime ou perfil." : "Escolha o próximo anime."}</h1>
        <form className="search-box" onSubmit={submit}>
          <Search aria-hidden size={20} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por título, gênero ou usuário"
            aria-label="Buscar por título, gênero ou usuário"
            autoFocus={searchFirst}
          />
          <button type="submit">Buscar</button>
        </form>
      </section>

      <section className="browse-toolbar" aria-label="Filtros">
        <div className="tab-strip">
          {tabs.map((tab) => (
            <button key={tab.key} className={activeTab === tab.key ? "tab-pill active" : "tab-pill"} type="button" onClick={() => setActiveTab(tab.key)}>
              {tab.label}
            </button>
          ))}
        </div>
        <label className="filter-select">
          <Filter aria-hidden size={16} />
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="all">Todos os tipos</option>
            <option value="anime">Animes</option>
            <option value="serie">Séries</option>
            <option value="movie">Filmes</option>
            <option value="special">Especiais</option>
          </select>
        </label>
        <span className="filter-summary"><SlidersHorizontal aria-hidden size={16} /> {filtered.length} resultados</span>
      </section>

      {error ? <div className="status-card danger">{error}</div> : null}
      {loading ? <div className="skeleton-grid" aria-label="Carregando resultados">{Array.from({ length: 8 }).map((_, index) => <span key={index} />)}</div> : null}

      {!loading && filtered.length > 0 ? (
        <section className="catalog-grid browse-grid" aria-label="Resultados">
          {filtered.map((item) => <CatalogCard key={`${item.source}:${item.id}`} item={item} />)}
        </section>
      ) : null}

      {!loading && filtered.length === 0 ? (
        <EmptyState title="Nada encontrado" body="Tente outro termo, remova filtros ou importe novos conteúdos no admin." />
      ) : null}
    </div>
  );
}
