"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, Mail, Lock, Loader2, ChevronLeft, UserPlus } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // -- Saved Accounts Logic --
  const [savedAccounts, setSavedAccounts] = useState<{email: string; name: string; avatar: string}[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<{email: string; name: string; avatar: string} | null>(null);
  const [showSavedList, setShowSavedList] = useState(true);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('savedAccounts') || '[]');
      if (saved.length > 0) {
        setSavedAccounts(saved);
        // Se vier da url ?email=... pré-selecionar
        const urlEmail = new URLSearchParams(window.location.search).get("email");
        if (urlEmail) {
          const acc = saved.find((s:any) => s.email === urlEmail);
          if (acc) {
            setSelectedAccount(acc);
            setIdentifier(acc.email);
            setShowSavedList(false);
          }
        }
      } else {
        setShowSavedList(false);
      }
    } catch(e) {
      setShowSavedList(false);
    }
  }, []);

  const selectSavedAccount = (acc: {email: string; name: string; avatar: string}) => {
    setSelectedAccount(acc);
    setIdentifier(acc.email);
    setShowSavedList(false);
  };

  const removeSavedAccount = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = savedAccounts.filter(a => a.email !== email);
      localStorage.setItem('savedAccounts', JSON.stringify(updated));
      setSavedAccounts(updated);
      if (updated.length === 0) setShowSavedList(false);
      if (selectedAccount?.email === email) {
        setSelectedAccount(null);
        setIdentifier("");
      }
    } catch(e) {}
  };

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

        {showSavedList && savedAccounts.length > 0 ? (
          <div className="space-y-4 animate-fadeInUp">
            <h2 className="text-center font-bold text-lg text-white mb-6">Suas Contas</h2>
            <div className="space-y-3">
              {savedAccounts.map(acc => (
                <div key={acc.email} onClick={() => selectSavedAccount(acc)}
                  className="w-full flex items-center justify-between p-3 bg-zinc-900/60 border border-zinc-700/50 hover:border-pink-500 rounded-2xl cursor-pointer transition group backdrop-blur-sm shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <img src={acc.avatar} alt="avatar" className="w-12 h-12 rounded-full object-cover border-2 border-zinc-800 group-hover:border-pink-500 transition" />
                    <div className="text-left">
                      <p className="font-bold text-white text-base">{acc.name}</p>
                      <p className="text-xs text-zinc-500">{acc.email}</p>
                    </div>
                  </div>
                  <button onClick={(e) => removeSavedAccount(acc.email, e)} className="p-2 text-zinc-600 hover:text-red-500 transition opacity-0 group-hover:opacity-100" title="Remover Conta">
                    <Loader2 size={16} className="hidden" /> {/* Dummy para manter lucide imported mas usar o proprio estilo, na real não precisamos usar icone aki ou usar um simples txt */}
                    <span className="text-xs font-bold uppercase">X</span>
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => setShowSavedList(false)}
              className="w-full mt-6 py-3.5 bg-zinc-900/40 text-pink-500 font-bold border border-zinc-800 hover:border-pink-500 rounded-2xl transition flex items-center justify-center gap-2"
            >
              <UserPlus size={18} /> Entrar em outra conta
            </button>
          </div>
        ) : (
          <div className="animate-fadeInUp">
            {selectedAccount && (
              <div className="flex items-center justify-between mb-6 bg-zinc-900/60 p-2 pr-4 rounded-full border border-zinc-800 shadow-sm">
                <div className="flex items-center gap-3">
                  <img src={selectedAccount.avatar} className="w-10 h-10 rounded-full object-cover" alt="avatar" />
                  <p className="font-bold text-white text-sm">{selectedAccount.email}</p>
                </div>
                {savedAccounts.length > 0 && (
                  <button type="button" onClick={() => { setShowSavedList(true); setSelectedAccount(null); setPassword(""); }} className="text-xs font-bold text-zinc-500 hover:text-pink-400 flex items-center gap-1 transition">
                    <ChevronLeft size={14} /> Trocar
                  </button>
                )}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              {!selectedAccount && (
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
              )}
              
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
          </div>
        )}



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
