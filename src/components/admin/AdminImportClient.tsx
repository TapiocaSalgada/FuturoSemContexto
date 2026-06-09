"use client";

import { FormEvent, useState } from "react";
import { DownloadCloud, Loader2, Plus } from "lucide-react";

type ProviderKey = "sugoi" | "anfire" | "playanimes" | "anisbr" | "animefenix";

type ImportResult = {
  id?: string;
  title?: string;
  image?: string;
  coverImage?: string;
  source?: string;
  slug?: string;
  url?: string;
  description?: string;
  raw?: any;
};

const providers: Array<{ key: ProviderKey; label: string; hint: string }> = [
  { key: "sugoi", label: "Sugoi", hint: "Busca por titulo e slug" },
  { key: "anfire", label: "AnFire", hint: "Busca por scraper/player" },
  { key: "playanimes", label: "PlayAnimes", hint: "Busca publica adaptada" },
  { key: "anisbr", label: "AnimesBrasil", hint: "Busca por nome" },
  { key: "animefenix", label: "AnimeFenix", hint: "Busca por keyword" },
];

function resultTitle(item: ImportResult) {
  return String(item.title || item.raw?.title || item.raw?.name || item.id || "Sem titulo");
}

function resultImage(item: ImportResult) {
  return String(item.image || item.coverImage || item.raw?.image || item.raw?.cover || "");
}

export default function AdminImportClient() {
  const [provider, setProvider] = useState<ProviderKey>("sugoi");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ImportResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function search(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (query.trim().length < 2) {
      setStatus("Informe pelo menos 2 caracteres.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch(`/api/admin/${provider}?q=${encodeURIComponent(query.trim())}`);
      if (!response.ok) throw new Error("provider failed");
      const payload = await response.json();
      const list = Array.isArray(payload) ? payload : payload?.results || payload?.items || [];
      setResults(list.slice(0, 24));
      if (list.length === 0) setStatus("Nenhum resultado encontrado.");
    } catch {
      setStatus("Falha ao consultar provider.");
    } finally {
      setLoading(false);
    }
  }

  async function createStub(item: ImportResult) {
    const title = resultTitle(item);
    setStatus(`Criando ${title}...`);
    const response = await fetch("/api/admin/anime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: item.description || "",
        coverImage: resultImage(item),
        bannerImage: resultImage(item),
        status: "ongoing",
        visibility: "public",
        externalProvider: "manual",
        autoMedia: false,
      }),
    });
    setStatus(response.ok ? "Entrada criada no catalogo." : "Nao foi possivel criar. Verifique duplicidade.");
  }

  return (
    <div className="admin-grid">
      <section className="admin-panel">
        <p className="eyebrow">Importar API</p>
        <h2>Buscar providers</h2>
        <form className="admin-search" onSubmit={search}>
          <select value={provider} onChange={(event) => setProvider(event.target.value as ProviderKey)}>
            {providers.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Titulo do anime" />
          <button className="primary-action" type="submit" disabled={loading}>
            {loading ? <Loader2 className="spin" aria-hidden size={18} /> : <DownloadCloud aria-hidden size={18} />}
            Buscar
          </button>
        </form>
        <p className="panel-note">{providers.find((item) => item.key === provider)?.hint}</p>
        {status ? <p className="form-status">{status}</p> : null}
      </section>

      <section className="admin-panel wide">
        <div className="section-heading">
          <div>
            <h2>Resultados</h2>
            <p>Criar uma entrada nao sobrescreve fontes manuais nem episodios existentes.</p>
          </div>
        </div>
        <div className="admin-result-list">
          {results.map((item, index) => (
            <article className="admin-result" key={`${resultTitle(item)}:${item.id || item.slug || index}`}>
              {resultImage(item) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resultImage(item)} alt="" />
              ) : (
                <div className="admin-thumb">{resultTitle(item).slice(0, 2).toUpperCase()}</div>
              )}
              <div>
                <strong>{resultTitle(item)}</strong>
                <span>{item.source || provider}</span>
                {item.slug ? <small>slug: {item.slug}</small> : null}
              </div>
              <button className="secondary-action" type="button" onClick={() => createStub(item)}>
                <Plus aria-hidden size={18} />
                Criar
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
