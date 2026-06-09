"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import PlayerShell from "@/components/player/PlayerShell";
import type { WatchPayload } from "@/components/player/types";

export default function WatchExperience({ id }: { id: string }) {
  const [payload, setPayload] = useState<WatchPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    fetch(`/api/watch/${encodeURIComponent(id)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("watch failed");
        return response.json();
      })
      .then((data) => { if (mounted) setPayload(data); })
      .catch(() => { if (mounted) setError("Não foi possível preparar o player."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [id]);

  if (loading) {
    return <section className="watch-stage centered"><Loader2 className="spin" aria-hidden size={28} /><p>Preparando player...</p></section>;
  }

  if (error || !payload) {
    return <section className="watch-stage centered"><AlertTriangle aria-hidden size={28} /><h1>Player indisponível</h1><p>{error || "Não encontramos esse episódio."}</p><Link className="primary-action" href="/explorar">Voltar ao catálogo</Link></section>;
  }

  return <PlayerShell payload={payload} />;
}
