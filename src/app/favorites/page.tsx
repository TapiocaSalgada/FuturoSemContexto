"use client";

import AppLayout from "@/components/AppLayout";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { UserCircle, Edit3, Check, UploadCloud, Lock, Unlock, Plus, FolderOpen, Trash2 } from "lucide-react";
import Link from "next/link";

interface Folder {
  id: string;
  name: string;
  isPrivate: boolean;
  favorites: { animeId: string; anime: { id: string; title: string; coverImage?: string } }[];
}

interface LooseFavorite {
  animeId: string;
  anime: { id: string; title: string; coverImage?: string };
  folder?: { id: string; name: string } | null;
}

function ImageUpload({ onUpload, label }: { onUpload: (url: string) => void; label: string }) {
  const [uploading, setUploading] = useState(false);
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "uploads");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) onUpload(data.url);
    setUploading(false);
  };
  return (
    <label className="flex items-center gap-2 cursor-pointer text-xs text-pink-500 hover:text-pink-400 font-bold transition">
      <UploadCloud size={12} /> {uploading ? "Enviando..." : label}
      <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
    </label>
  );
}

export default function FavoritesPage() {
  const { data: session } = useSession();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [looseFavorites, setLooseFavorites] = useState<LooseFavorite[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const loadFolders = () => fetch("/api/favorites/folders").then(r => r.json()).then(setFolders);
  const loadLooseFavorites = () => fetch("/api/favorites").then(r => r.json()).then((data: LooseFavorite[]) => setLooseFavorites(data.filter(favorite => !favorite.folder)));
  useEffect(() => { if (session) { loadFolders(); loadLooseFavorites(); } }, [session]);

  const createFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await fetch("/api/favorites/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newFolderName }) });
    setNewFolderName("");
    loadFolders();
    loadLooseFavorites();
  };

  const togglePrivate = async (f: Folder) => {
    await fetch("/api/favorites/folders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: f.id, name: f.name, isPrivate: !f.isPrivate }) });
    loadFolders();
    loadLooseFavorites();
  };

  const saveEdit = async (id: string) => {
    await fetch("/api/favorites/folders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name: editName }) });
    setEditingFolder(null);
    loadFolders();
    loadLooseFavorites();
  };

  const deleteFolder = async (id: string) => {
    if (!confirm("Apagar esta pasta?")) return;
    await fetch("/api/favorites/folders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    loadFolders();
    loadLooseFavorites();
  };

  if (!session) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <Link href="/login" className="text-pink-500 hover:underline font-bold">Faça login para ver sua lista</Link>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-6 lg:p-10 pb-24 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-black">Minha <span className="text-pink-500">Lista</span></h1>
          <p className="text-zinc-500 text-sm mt-1">Organize seus animes favoritos em pastas personalizadas.</p>
        </div>

        {/* Create Folder */}
        <form onSubmit={createFolder} className="flex items-center gap-3">
          <input
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="Nome da nova pasta..."
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink-500 transition"
          />
          <button type="submit" className="flex items-center gap-2 bg-pink-600 hover:bg-pink-500 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition">
            <Plus size={16} /> Criar Pasta
          </button>
        </form>

        {/* Folders */}
        {folders.length === 0 && looseFavorites.length === 0 && (
          <div className="text-center py-16 text-zinc-500">
            <FolderOpen size={48} className="mx-auto mb-4 opacity-30" />
            <p className="font-bold">Nenhuma pasta criada ainda.</p>
            <p className="text-sm mt-1">Crie uma pasta e comece a adicionar animes!</p>
          </div>
        )}

        <div className="space-y-6">
          {looseFavorites.length > 0 && (
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <FolderOpen size={18} className="text-pink-500" />
                  <span className="font-bold text-white">Sem pasta</span>
                  <span className="text-xs text-zinc-500">{looseFavorites.length} item{looseFavorites.length !== 1 ? "s" : ""}</span>
                </div>
              </div>

              <div className="p-5">
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {looseFavorites.map(fav => (
                    <Link key={fav.animeId} href={`/anime/${fav.anime.id}`}
                      className="w-[100px] shrink-0 group">
                      <div className="aspect-[2/3] rounded-xl overflow-hidden border border-zinc-800 group-hover:border-pink-500 transition">
                        <img src={fav.anime.coverImage || "https://via.placeholder.com/200x300?text=?"} alt={fav.anime.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      </div>
                      <p className="text-xs text-zinc-400 group-hover:text-white transition mt-2 truncate text-center">{fav.anime.title}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
          {folders.map(folder => (
            <div key={folder.id} className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                {editingFolder === folder.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input value={editName} onChange={e => setEditName(e.target.value)} className="bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-1.5 text-white text-sm flex-1 focus:outline-none focus:border-pink-500 transition" />
                    <button onClick={() => saveEdit(folder.id)} className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition"><Check size={14} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <FolderOpen size={18} className="text-pink-500" />
                    <span className="font-bold text-white">{folder.name}</span>
                    <span className="text-xs text-zinc-500">{folder.favorites.length} item{folder.favorites.length !== 1 ? "s" : ""}</span>
                    {folder.isPrivate && <span className="text-xs bg-zinc-700 text-zinc-400 px-2 py-0.5 rounded-full flex items-center gap-1"><Lock size={8} /> Privada</span>}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button onClick={() => togglePrivate(folder)} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition" title={folder.isPrivate ? "Tornar Pública" : "Tornar Privada"}>
                    {folder.isPrivate ? <Unlock size={15} /> : <Lock size={15} />}
                  </button>
                  <button onClick={() => { setEditingFolder(folder.id); setEditName(folder.name); }} className="p-2 text-zinc-500 hover:text-blue-400 hover:bg-zinc-800 rounded-lg transition">
                    <Edit3 size={15} />
                  </button>
                  <button onClick={() => deleteFolder(folder.id)} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="p-5">
                {folder.favorites.length === 0 ? (
                  <p className="text-zinc-600 text-sm text-center py-6">Pasta vazia. Acesse um anime e adicione-o aqui!</p>
                ) : (
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                    {folder.favorites.map(fav => (
                      <Link key={fav.animeId} href={`/anime/${fav.anime.id}`}
                        className="w-[100px] shrink-0 group">
                        <div className="aspect-[2/3] rounded-xl overflow-hidden border border-zinc-800 group-hover:border-pink-500 transition">
                          <img src={fav.anime.coverImage || "https://via.placeholder.com/200x300?text=?"} alt={fav.anime.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                        </div>
                        <p className="text-xs text-zinc-400 group-hover:text-white transition mt-2 truncate text-center">{fav.anime.title}</p>
                      </Link>
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
