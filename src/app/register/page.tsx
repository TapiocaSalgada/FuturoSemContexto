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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#060606]">
      {/* Animated bg */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-t from-[#060606] via-[#060606]/90 to-[#060606]/60 z-10" />
        <img
          src="https://images.unsplash.com/photo-1618773928120-192518e95085?auto=format&fit=crop&q=80"
          className="w-full h-full object-cover opacity-20"
          alt="bg"
        />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      <div className="relative z-20 w-full max-w-md p-8 mx-4 bg-[#0d0d0d]/90 backdrop-blur-2xl border border-pink-500/20 rounded-3xl shadow-[0_0_60px_rgba(255,0,127,0.15)] animate-fadeInUp">
        <div className="flex flex-col items-center gap-2 mb-8">
          <Heart className="text-pink-500 w-14 h-14 fill-pink-500 drop-shadow-[0_0_20px_rgba(255,0,127,0.8)]" />
          <h1 className="text-xl font-black tracking-tighter text-pink-500 leading-none text-center mt-2">
            FUTURO SEM <br /><span className="text-white uppercase">Contexto</span>
          </h1>
          <p className="text-zinc-500 text-xs mt-1">Crie sua conta gratuitamente</p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 text-red-400 rounded-xl mb-6 text-sm text-center font-bold">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-400 mb-1.5 block">Como seus amigos te chamam?</label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-zinc-900/70 border border-zinc-800 rounded-xl focus:outline-none focus:border-pink-500 transition text-white text-sm"
                placeholder="Seu apelido"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-400 mb-1.5 block">E-mail</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-zinc-900/70 border border-zinc-800 rounded-xl focus:outline-none focus:border-pink-500 transition text-white text-sm"
                placeholder="seu@email.com"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-400 mb-1.5 block">Senha (mínimo 6 caracteres)</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-zinc-900/70 border border-zinc-800 rounded-xl focus:outline-none focus:border-pink-500 transition text-white text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 disabled:opacity-60 bg-pink-600 hover:bg-pink-500 text-white font-black py-3.5 rounded-xl shadow-[0_0_20px_rgba(255,0,127,0.4)] hover:shadow-[0_0_30px_rgba(255,0,127,0.6)] transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {loading ? "CRIANDO CONTA..." : "CRIAR CONTA"}
          </button>
        </form>

        <p className="mt-8 text-center text-zinc-500 text-sm">
          Já tem conta?{" "}
          <Link href="/login" className="text-pink-500 font-bold hover:text-pink-400 transition">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
