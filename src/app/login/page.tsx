"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, Mail, Lock, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email: identifier,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("E-mail, usuário ou senha incorretos.");
    } else {
      router.push("/");
      router.refresh();
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
        {/* Neon ambient glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-20 w-full max-w-md p-8 mx-4 bg-[#0d0d0d]/90 backdrop-blur-2xl border border-pink-500/20 rounded-3xl shadow-[0_0_60px_rgba(255,0,127,0.15)] animate-fadeInUp">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="relative">
            <Heart className="text-pink-500 w-14 h-14 fill-pink-500 drop-shadow-[0_0_20px_rgba(255,0,127,0.8)]" />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-pink-500 leading-none text-center mt-2">
            FUTURO SEM <br /><span className="text-white uppercase">Contexto</span>
          </h1>
          <p className="text-zinc-500 text-xs mt-1">Bem-vindo de volta!</p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 text-red-400 rounded-xl mb-6 text-sm text-center font-bold animate-fadeInUp">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-400 mb-1.5 block">E-mail ou Nome de Usuário</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-zinc-900/70 border border-zinc-800 rounded-xl focus:outline-none focus:border-pink-500 transition text-white text-sm"
                placeholder="seu@email.com ou seu_usuario"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-400 mb-1.5 block">Senha</label>
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
            {loading ? "ENTRANDO..." : "ENTRAR"}
          </button>
        </form>



        <p className="mt-8 text-center text-zinc-500 text-sm">
          Novo no Futuro Stream?{" "}
          <Link href="/register" className="text-pink-500 font-bold hover:text-pink-400 transition">
            Cadastrar
          </Link>
        </p>
      </div>
    </div>
  );
}
