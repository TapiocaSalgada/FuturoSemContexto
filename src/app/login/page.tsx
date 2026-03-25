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

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-zinc-800" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
            <span className="bg-[#0d0d0d] px-4 text-zinc-500">Ou entre com</span>
          </div>
        </div>

        <button
          onClick={() => signIn("discord")}
          className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-black py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mb-6 shadow-[0_0_20px_rgba(88,101,242,0.2)] hover:shadow-[0_0_30px_rgba(88,101,242,0.4)]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 127.14 96.36"><path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 109.27 109.27 0 0 0-29.08 0 72.37 72.37 0 0 0-3.37-6.83 105.43 105.43 0 0 0-26.23 8.09C2.04 33.84-2.69 58.85.92 83.46a105.73 105.73 0 0 0 32.14 16.14 77.7 77.7 0 0 0 6.89-11.11 72.17 72.17 0 0 1-10.82-5.18c.9-.66 1.8-1.35 2.66-2a75.34 75.34 0 0 0 64.32 0c.87.68 1.76 1.34 2.66 2a72.55 72.55 0 0 1-10.85 5.18 78 78 0 0 0 6.89 11.1 105.35 105.35 0 0 0 32.19-16.14c3.9-27.42-4.14-51.48-19.3-75.38zm-51.06 65.6c-6.17 0-11.3-5.63-11.3-12.54 0-6.9 4.96-12.54 11.3-12.54 6.34 0 11.45 5.68 11.3 12.54 0 6.91-4.96 12.54-11.3 12.54zm33.85 0c-6.17 0-11.3-5.63-11.3-12.54 0-6.9 4.96-12.54 11.3-12.54 6.34 0 11.45 5.68 11.3 12.54 0 6.91-4.96 12.54-11.3 12.54z"/></svg>
          DISCORD
        </button>

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
