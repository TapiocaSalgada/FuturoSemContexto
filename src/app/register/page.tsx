"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, User, Mail, Lock, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError("A senha precisa ter pelo menos 6 caracteres."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      if (res.ok) {
        router.push("/login");
      } else {
        const text = await res.text();
        setError(text || "Erro ao criar conta. Tente novamente.");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[var(--background)]">
      {/* Animated bg */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/90 to-[var(--background)]/60 z-10" />
        <img
          src="/stitch/explore-noir.png"
          className="w-full h-full object-cover opacity-24"
          alt="Fundo Futuro Noir"
        />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 18%, transparent)" }} />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-slate-400/10 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      <div className="relative z-20 w-full max-w-md p-8 mx-4 glass-surface-heavy rounded-3xl shadow-2xl animate-fadeInUp" style={{ boxShadow: "0 0 60px color-mix(in srgb, var(--accent) 18%, transparent)" }}>
        <div className="flex flex-col items-center gap-2 mb-8">
          <Heart className="w-14 h-14 fill-current drop-shadow-lg" style={{ color: "var(--accent)" }} />
          <h1 className="text-xl font-black tracking-tighter leading-none text-center mt-2" style={{ color: "var(--accent)" }}>
            FUTURO SEM <br /><span className="text-white uppercase">Contexto</span>
          </h1>
          <p className="text-[var(--text-muted)] text-xs mt-1">Crie sua conta gratuitamente</p>
        </div>

        {error && (
          <div className="p-3 bg-purple-500/20 border border-purple-500/50 text-purple-400 rounded-xl mb-6 text-sm text-center font-bold">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-400 mb-1.5 block">Como seus amigos te chamam?</label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="kdr-input w-full pl-9 pr-4 py-3 rounded-xl text-sm"
                placeholder="Seu apelido"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-400 mb-1.5 block">E-mail</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="kdr-input w-full pl-9 pr-4 py-3 rounded-xl text-sm"
                placeholder="seu@email.com"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-400 mb-1.5 block">Senha (mínimo 6 caracteres)</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="kdr-input w-full pl-9 pr-4 py-3 rounded-xl text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="kdr-btn-primary w-full h-[52px] mt-2 disabled:opacity-60"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {loading ? "CRIANDO CONTA..." : "CRIAR CONTA"}
          </button>
        </form>



        <p className="mt-8 text-center text-zinc-500 text-sm">
          Já tem conta?{" "}
          <Link href="/login" className="font-bold transition kdr-section-title-accent hover:text-white">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
