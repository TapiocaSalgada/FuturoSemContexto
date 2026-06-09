"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { showToast } from "@/components/Toast";

export default function FavoriteButton({
  animeId,
  enabled,
  initialFavorited,
}: {
  animeId: string;
  enabled: boolean;
  initialFavorited?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [favorited, setFavorited] = useState(initialFavorited || false);

  async function toggle() {
    if (!enabled || loading) return;
    setLoading(true);
    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeId }),
      });
      if (!response.ok) throw new Error("failed");
      const payload = await response.json();
      const newState = !!payload?.favorited;
      setFavorited(newState);
      showToast(newState ? "Adicionado à sua lista! ❤️" : "Removido da sua lista.", newState ? "success" : "info");
    } catch {
      showToast("Não foi possível salvar. Tente novamente.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      className={favorited ? "secondary-action favorited" : "secondary-action"}
      type="button"
      disabled={!enabled || loading}
      onClick={toggle}
      style={favorited ? { borderColor: "rgba(251, 113, 133, 0.4)", background: "rgba(251, 113, 133, 0.1)" } : undefined}
    >
      <Heart
        aria-hidden
        size={18}
        fill={favorited ? "#fb7185" : "none"}
        color={favorited ? "#fb7185" : "currentColor"}
        style={{ transition: "all 0.3s ease" }}
      />
      {loading ? "Salvando..." : favorited ? "Na minha lista" : "Minha lista"}
    </button>
  );
}
