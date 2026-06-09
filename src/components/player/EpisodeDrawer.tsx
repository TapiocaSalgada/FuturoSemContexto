"use client";

import Link from "next/link";
import { X } from "lucide-react";

import type { WatchPlaylistItem } from "@/components/player/types";

type EpisodeDrawerProps = {
  open: boolean;
  currentId: string;
  items: WatchPlaylistItem[];
  onClose: () => void;
};

export default function EpisodeDrawer({ open, currentId, items, onClose }: EpisodeDrawerProps) {
  if (!open) return null;
  return (
    <aside className="episode-drawer" aria-label="Lista de episódios">
      <div className="drawer-header"><strong>Episódios</strong><button type="button" aria-label="Fechar" onClick={onClose}><X aria-hidden size={20} /></button></div>
      <div className="drawer-list">
        {items.length === 0 ? <p>Nenhum episódio na playlist.</p> : null}
        {items.map((item) => {
          const href = item.href || `/watch/${item.id}`;
          return <Link key={item.id} className={item.id === currentId ? "drawer-item active" : "drawer-item"} href={href}><span>T{item.season || 1} E{item.number}</span><strong>{item.title}</strong></Link>;
        })}
      </div>
    </aside>
  );
}
