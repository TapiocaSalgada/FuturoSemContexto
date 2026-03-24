"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (res?.error) {
      setError("Credenciais inválidas");
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Bg */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-t from-[#060606] via-[#060606]/90 to-[#060606]/60 z-10" />
        <img src="https://images.unsplash.com/photo-1618773928120-192518e95085?auto=format&fit=crop&q=80" className="w-full h-full object-cover opacity-30" alt="bg" />
      </div>

      <div className="relative z-20 w-full max-w-md p-8 bg-[#0d0d0d]/80 backdrop-blur-2xl border border-pink-500/20 rounded-3xl shadow-[0_0_50px_rgba(255,0,127,0.15)]">
        <div className="flex flex-col items-center gap-2 mb-8">
          <Heart className="text-pink-500 w-12 h-12 fill-pink-500 drop-shadow-[0_0_15px_rgba(255,0,127,0.8)]" />
          <h1 className="text-xl font-black tracking-tighter text-pink-500 leading-none text-center mt-2">
            FUTURO SEM <br /><span className="text-white uppercase">Contexto</span>
          </h1>
        </div>

        {error && <div className="p-3 bg-red-500/20 border border-red-500 text-red-500 rounded-xl mb-6 text-sm text-center font-bold">{error}</div>}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-bold text-zinc-400">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full mt-1 bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-pink-500 transition text-white" />
          </div>
          <div>
            <label className="text-sm font-bold text-zinc-400">Senha</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full mt-1 bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-pink-500 transition text-white" />
          </div>
          <button type="submit" className="w-full mt-4 bg-pink-600 hover:bg-pink-500 text-white font-black py-4 rounded-xl shadow-[0_0_20px_rgba(255,0,127,0.4)] transition">
            ACESSAR CATÁLOGO
          </button>
        </form>

        <p className="mt-8 text-center text-zinc-500 text-sm">
          Novo no Futuro Stream? <Link href="/register" className="text-pink-500 font-bold hover:text-pink-400 transition">Assine agora</Link>
        </p>
      </div>
    </div>
  );
}
