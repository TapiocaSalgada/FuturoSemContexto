"use client";

import AppLayout from "@/components/AppLayout";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Edit3, Check, Lock, Unlock, Plus, FolderOpen, Trash2 } from "lucide-react";
import Link from "next/link";
import AnimeCard from "@/components/AnimeCard";

interface Folder {
  id: string;
  name: string;
  isPrivate: boolean;
  favorites: { animeId: string; anime: { id: string; title: string; coverImage?: string; visibility?: string } }[];
}

interface LooseFavorite {
  animeId: string;
  anime: { id: string; title: string; coverImage?: string; visibility?: string };
  folder?: { id: string; name: string } | null;
}

export default function FavoritesPage() {
  const { data: session } = useSession();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [looseFavorites, setLooseFavorites] = useState<LooseFavorite[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const loadFolders = () => fetch("/api/favorites/folders").then((r) => r.json()).then(setFolders);
  const loadLooseFavorites = () =>
    fetch("/api/favorites")
      .then((r) => r.json())
      .then((data: LooseFavorite[]) => setLooseFavorites(data.filter((favorite) => !favorite.folder)));

  useEffect(() => {
    if (session) {
      loadFolders();
      loadLooseFavorites();
    }
  }, [session]);

  const createFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await fetch("/api/favorites/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFolderName }),
    });
    setNewFolderName("");
    loadFolders();
    loadLooseFavorites();
  };

  const togglePrivate = async (folder: Folder) => {
    await fetch("/api/favorites/folders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: folder.id, name: folder.name, isPrivate: !folder.isPrivate }),
    });
    loadFolders();
    loadLooseFavorites();
  };

  const saveEdit = async (id: string) => {
    await fetch("/api/favorites/folders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName }),
    });
    setEditingFolder(null);
    loadFolders();
    loadLooseFavorites();
  };

  const deleteFolder = async (id: string) => {
    if (!confirm("Apagar esta pasta?")) return;
    await fetch("/api/favorites/folders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadFolders();
    loadLooseFavorites();
  };

  const removeFavorite = async (animeId: string) => {
    await fetch("/api/favorites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ animeId }),
    });
    loadFolders();
    loadLooseFavorites();
  };

  if (!session) {
    return (
      <AppLayout>
        <div className="kdr-page-shell max-w-6xl">
          <div className="min-h-[42vh] flex items-center justify-center text-center px-4">
            <Link href="/login" className="kdr-btn-primary h-11 px-6 text-sm">
              Faça login para ver sua lista
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="kdr-page-shell max-w-6xl kdr-page-stack">
        <div className="kdr-page-hero">
          <p className="kdr-page-eyebrow">Minha coleção</p>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">Favoritos</h1>
          <p className="kdr-page-lead">Organize seus animes em pastas privadas ou públicas, com fluxo rápido para maratonar depois.</p>
        </div>

        <form onSubmit={createFolder} className="glass-surface rounded-2xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Nome da nova pasta..."
            className="kdr-input flex-1 rounded-xl px-4 py-3 sm:py-2.5 text-sm"
          />
          <button type="submit" className="kdr-btn-primary px-5 py-3 sm:py-2.5 rounded-xl text-sm min-h-[44px] shrink-0">
            <Plus size={16} /> Criar pasta
          </button>
        </form>

        {folders.length === 0 && looseFavorites.length === 0 ? (
          <div className="text-center py-16 text-[var(--text-muted)]">
            <FolderOpen size={48} className="mx-auto mb-4 opacity-40" />
            <p className="font-bold text-[var(--text-secondary)]">Nenhuma pasta criada ainda.</p>
            <p className="text-sm mt-1">Crie uma pasta e comece a adicionar animes.</p>
          </div>
        ) : null}

        <div className="space-y-6">
          {looseFavorites.length > 0 ? (
            <div className="glass-card border border-white/10 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <FolderOpen size={18} className="kdr-section-title-accent" />
                  <span className="font-bold text-white">Sem pasta</span>
                  <span className="text-xs text-zinc-500">{looseFavorites.length} item{looseFavorites.length !== 1 ? "s" : ""}</span>
                </div>
              </div>

              <div className="p-5">
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {looseFavorites
                    .filter((fav) => !fav.anime.visibility || fav.anime.visibility === "public")
                    .map((fav) => (
                      <div key={fav.animeId} className="relative">
                        <AnimeCard
                          href={`/anime/${fav.anime.id}`}
                          title={fav.anime.title}
                          image={fav.anime.coverImage}
                          className="w-[110px] sm:w-[130px]"
                          subTitle={fav.anime.title}
                        />
                        <button
                          onClick={() => removeFavorite(fav.animeId)}
                          className="absolute top-2 right-2 z-20 p-1.5 rounded-lg bg-black/70 text-zinc-300 hover:text-purple-400 hover:bg-purple-500/20 transition"
                          title="Remover favorito"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : null}

          {folders.map((folder) => (
            <div key={folder.id} className="glass-card border border-white/10 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                {editingFolder === folder.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="kdr-input flex-1 rounded-lg px-3 py-1.5 text-sm"
                    />
                    <button onClick={() => saveEdit(folder.id)} className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition">
                      <Check size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <FolderOpen size={18} className="kdr-section-title-accent" />
                    <span className="font-bold text-white">{folder.name}</span>
                    <span className="text-xs text-zinc-500">{folder.favorites.length} item{folder.favorites.length !== 1 ? "s" : ""}</span>
                    {folder.isPrivate ? (
                      <span className="text-xs bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Lock size={8} /> Privada
                      </span>
                    ) : null}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => togglePrivate(folder)}
                    className="p-2.5 sm:p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition min-w-[40px] min-h-[40px] inline-flex items-center justify-center"
                    title={folder.isPrivate ? "Tornar pública" : "Tornar privada"}
                  >
                    {folder.isPrivate ? <Unlock size={15} /> : <Lock size={15} />}
                  </button>
                  <button
                    onClick={() => {
                      setEditingFolder(folder.id);
                      setEditName(folder.name);
                    }}
                    className="p-2.5 sm:p-2 text-zinc-500 hover:text-blue-400 hover:bg-zinc-800 rounded-lg transition min-w-[40px] min-h-[40px] inline-flex items-center justify-center"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={() => deleteFolder(folder.id)}
                    className="p-2.5 sm:p-2 text-zinc-500 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition min-w-[40px] min-h-[40px] inline-flex items-center justify-center"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="p-5">
                {folder.favorites.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-6">Pasta vazia. Acesse um anime e adicione-o aqui.</p>
                ) : (
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                    {folder.favorites
                      .filter((fav) => !fav.anime.visibility || fav.anime.visibility === "public")
                      .map((fav) => (
                        <div key={fav.animeId} className="relative">
                          <AnimeCard
                            href={`/anime/${fav.anime.id}`}
                            title={fav.anime.title}
                            image={fav.anime.coverImage}
                            className="w-[110px] sm:w-[130px]"
                            subTitle={fav.anime.title}
                          />
                          <button
                            onClick={() => removeFavorite(fav.animeId)}
                            className="absolute top-2 right-2 z-20 p-1.5 rounded-lg bg-black/70 text-zinc-300 hover:text-purple-400 hover:bg-purple-500/20 transition"
                            title="Remover favorito"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
