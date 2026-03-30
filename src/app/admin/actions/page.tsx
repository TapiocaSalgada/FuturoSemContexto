"use client";

import AppLayout from "@/components/AppLayout";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, Unlock, Eye, EyeOff, Loader2 } from "lucide-react";

interface UserItem {
  id: string; name: string; email: string; role: string; isTimedOut?: string | null;
}
interface AnimeItem {
  id: string; title: string; visibility: string;
}

export default function AdminActions() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [animes, setAnimes] = useState<AnimeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    // @ts-expect-error role
    if (status === "unauthenticated" || (status === "authenticated" && session?.user?.role !== "admin")) {
      router.push("/");
      return;
    }
    if (status === "authenticated") loadData();
  }, [status, session]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [u, a] = await Promise.all([
        fetch("/api/admin/users").then(r => r.json()),
        fetch("/api/admin/anime").then(r => r.json()),
      ]);
      setUsers(u || []);
      setAnimes(a || []);
    } finally {
      setLoading(false);
    }
  };

  const notify = (text: string) => { setMsg(text); setTimeout(() => setMsg(""), 3000); };

  const toggleBan = async (user: UserItem) => {
    const isBanned = Boolean(user.isTimedOut);
    const timeoutUntil = isBanned ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, timeoutUntil }),
    });
    notify(isBanned ? "Usuário desbanido" : "Usuário banido (7 dias)" );
    loadData();
  };

  const toggleVisibility = async (anime: AnimeItem) => {
    const nextVis = anime.visibility === "public" ? "admin_only" : "public";
    await fetch("/api/admin/anime", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: anime.id, visibility: nextVis }),
    });
    notify(`Visibilidade alterada para ${nextVis}`);
    loadData();
  };

  if (status === "loading" || loading) {
    return (
      <AppLayout>
        <div className="p-6 flex items-center gap-3 text-white"><Loader2 className="animate-spin" size={18}/> Carregando...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-10 space-y-8">
        <div className="flex items-center gap-2 text-pink-500 font-black uppercase text-sm">
          <ShieldCheck size={18} /> Ações Rápidas (Admin)
        </div>
        {msg && <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-300 text-sm font-bold">{msg}</div>}

        <section className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5 space-y-3">
          <h3 className="text-white font-black text-lg">Usuários</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {users.map(u => (
              <div key={u.id} className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <p className="text-white font-bold text-sm">{u.name}</p>
                  <p className="text-xs text-zinc-500">{u.email}</p>
                  <p className="text-[11px] text-zinc-500 uppercase">{u.role}</p>
                </div>
                <button
                  onClick={() => toggleBan(u)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 ${u.isTimedOut ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}
                >
                  {u.isTimedOut ? <Unlock size={14}/> : <Lock size={14}/>} {u.isTimedOut ? "Desbanir" : "Banir"}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5 space-y-3">
          <h3 className="text-white font-black text-lg">Catálogo</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {animes.map(a => (
              <div key={a.id} className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <p className="text-white font-bold text-sm">{a.title}</p>
                  <p className="text-[11px] text-zinc-500 uppercase">{a.visibility}</p>
                </div>
                <button
                  onClick={() => toggleVisibility(a)}
                  className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 bg-zinc-800 text-white hover:bg-pink-600"
                >
                  {a.visibility === "public" ? <EyeOff size={14}/> : <Eye size={14}/>} {a.visibility === "public" ? "Ocultar" : "Publicar"}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
