"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";

type ProviderHealth = {
  id: string;
  label: string;
  status: "online" | "offline" | "unknown";
  latencyMs: number | null;
  message: string;
  checkedAt: string;
};

export default function AdminApisClient() {
  const [items, setItems] = useState<ProviderHealth[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/providers/health", { cache: "no-store" });
      if (!response.ok) throw new Error("health failed");
      const payload = await response.json();
      setItems(payload.providers || []);
    } catch {
      setError("Nao foi possivel consultar health.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="stack-page">
      <section className="admin-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">APIs e Health</p>
            <h1>Status dos providers</h1>
            <p>Detalhes tecnicos ficam restritos ao admin.</p>
          </div>
          <button className="secondary-action" type="button" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "spin" : ""} aria-hidden size={18} />
            Atualizar
          </button>
        </div>
        {error ? <p className="form-status danger">{error}</p> : null}
      </section>

      <section className="provider-grid">
        {items.map((item) => (
          <article className="provider-card" key={item.id}>
            <Activity aria-hidden size={22} />
            <div>
              <strong>{item.label}</strong>
              <span className={`health-pill ${item.status}`}>{item.status}</span>
              <p>{item.message}</p>
              <small>
                {item.latencyMs !== null ? `${item.latencyMs} ms` : "sem latencia"} / {new Date(item.checkedAt).toLocaleString("pt-BR")}
              </small>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
