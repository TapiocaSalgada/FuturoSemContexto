"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, Mail, Lock, Loader2, ChevronLeft, UserPlus, Sparkles } from "lucide-react";

import {
  readSavedAccounts,
  removeSavedAccount as removeSavedAccountEntry,
  upsertSavedAccount,
  type SavedAccount,
} from "@/lib/saved-accounts";

type LoginAccount = {
  email: string;
  name: string;
  avatar: string;
  handoffHash?: string;
  role?: string;
};

function normalizeForUi(accounts: SavedAccount[]): LoginAccount[] {
  return accounts.map((account) => {
    const name = String(account.name || account.email).trim() || account.email;
    const avatar =
      String(account.avatar || "").trim() ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1f2937&color=fff`;

    return {
      email: account.email,
      name,
      avatar,
      handoffHash: account.handoffHash,
      role: account.role,
    };
  });
}

export default function LoginPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("Entrando...");
  
  // -- Saved Accounts Logic --
  const [savedAccounts, setSavedAccounts] = useState<LoginAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<LoginAccount | null>(null);
  const [showSavedList, setShowSavedList] = useState(true);

  const persistSavedAccount = (account: LoginAccount) => {
    if (!account.email) return;

    const next = upsertSavedAccount(account, 8);
    setSavedAccounts(normalizeForUi(next));
  };

  const refreshSavedFromSession = async (fallbackIdentifier: string) => {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const sessionData = await response.json().catch(() => null);
      const user = sessionData?.user;
      if (!user?.email) {
        return;
      }

      const account: LoginAccount = {
        email: String(user.email),
        name: String(user.name || user.email),
        avatar:
          String(user.image || "").trim() ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(String(user.name || "U"))}&background=1f2937&color=fff`,
        handoffHash: typeof user.handoffHash === "string" ? user.handoffHash : undefined,
        role: typeof user.role === "string" ? user.role : undefined,
      };

      persistSavedAccount(account);
    } catch {
      if (!fallbackIdentifier.includes("@")) return;
      persistSavedAccount({
        email: fallbackIdentifier,
        name: fallbackIdentifier,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackIdentifier)}&background=1f2937&color=fff`,
      });
    }
  };

  useEffect(() => {
    try {
      const saved = normalizeForUi(readSavedAccounts(8));
      if (saved.length > 0) {
        setSavedAccounts(saved);
        const urlEmail = new URLSearchParams(window.location.search).get("email");
        if (urlEmail) {
          const normalized = String(urlEmail).trim().toLowerCase();
          const account = saved.find((item) => item.email === normalized);
          if (account) {
            setSelectedAccount(account);
            setIdentifier(account.email);
          }
        }
      } else {
        setShowSavedList(false);
      }
    } catch {
      setShowSavedList(false);
    }
  }, []);

  // Update localStorage with NEW handoffHash from session after login
  useEffect(() => {
    if (!session?.user) return;

    const user = session.user as any;
    if (!user?.email) return;

    persistSavedAccount({
      email: String(user.email),
      name: String(user.name || user.email),
      avatar:
        String(user.image || "").trim() ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(String(user.name || "U"))}&background=1f2937&color=fff`,
      handoffHash: typeof user.handoffHash === "string" ? user.handoffHash : undefined,
      role: typeof user.role === "string" ? user.role : undefined,
    });
  }, [session]);

  const selectSavedAccount = async (acc: LoginAccount) => {
    if (acc.handoffHash) {
      setLoading(true);
      setLoadingStatus("Preparando sua sessão...");
      const res = await signIn("credentials", {
        email: acc.email,
        password: acc.handoffHash,
        isQuick: "true",
        redirect: false,
      });
      if (res?.error) {
        setLoading(false);
        setError("Sessão expirada. Entre com sua senha novamente.");
        setSelectedAccount(acc);
        setIdentifier(acc.email);
        setShowSavedList(false);
      } else {
        await refreshSavedFromSession(acc.email);
        setLoadingStatus("Bem-vindo de volta!");
        router.push("/");
        router.refresh();
      }
    } else {
      setSelectedAccount(acc);
      setIdentifier(acc.email);
      setShowSavedList(false);
    }
  };

  const removeSavedAccount = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = normalizeForUi(removeSavedAccountEntry(email, 8));
    setSavedAccounts(updated);
    if (updated.length === 0) setShowSavedList(false);
    if (selectedAccount?.email === email) {
      setSelectedAccount(null);
      setIdentifier("");
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setError("Informe e-mail ou usuário.");
      return;
    }
    setLoading(true);
    setLoadingStatus("Autenticando...");
    setError("");
    const res = await signIn("credentials", {
      email: cleanIdentifier,
      password,
      isQuick: "false",
      redirect: false,
    });
    if (res?.error) {
      setLoading(false);
      setError(String(res.error || "E-mail, usuário ou senha incorretos."));
    } else {
      await refreshSavedFromSession(cleanIdentifier);
      setLoadingStatus("Quase pronto...");
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[var(--background)]">
      {/* Animated bg */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/90 to-[var(--background)]/65 z-10" />
        <img
          src="https://images.unsplash.com/photo-1618773928120-192518e95085?auto=format&fit=crop&q=80"
          className="w-full h-full object-cover opacity-24"
          alt="bg"
        />
        {/* Neon ambient glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 18%, transparent)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-20 w-full max-w-md p-6 sm:p-8 mx-4 glass-surface-heavy rounded-3xl shadow-2xl animate-fadeInUp" style={{ boxShadow: `0 0 60px color-mix(in srgb, var(--accent) 18%, transparent)` }}>
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="relative">
            <Heart className="w-14 h-14 fill-current drop-shadow-lg" style={{ color: 'var(--accent)' }} />
          </div>
          <h1 className="text-xl font-black tracking-tighter leading-none text-center mt-2" style={{ color: 'var(--accent)' }}>
            FUTURO SEM <br /><span className="text-white uppercase">Contexto</span>
          </h1>
          <p className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest mt-1 font-bold">PLATAFORMA</p>
        </div>

        {/* Full Screen Immersive Loading */}
        {loading && (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-2xl animate-fadeIn">
            <div className="relative">
              <div className="absolute inset-0 blur-3xl animate-pulse" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 22%, transparent)" }} />
              <Loader2 className="w-16 h-16 animate-spin relative z-10" style={{ color: 'var(--accent)' }} />
            </div>
            <p className="mt-6 text-white font-black text-xl tracking-tighter animate-pulse">{loadingStatus}</p>
            <div className="mt-2 flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ animationDelay: "0s", backgroundColor: "var(--accent)" }} />
              <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ animationDelay: "0.2s", backgroundColor: "var(--accent)" }} />
              <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ animationDelay: "0.4s", backgroundColor: "var(--accent)" }} />
            </div>
          </div>
        )}

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
                className="w-full flex items-center justify-between p-3.5 sm:p-3 glass-card hover:border-white/30 rounded-2xl cursor-pointer transition group shadow-md min-h-[64px]"
                >
                  <div className="flex items-center gap-4">
                    <img src={acc.avatar} alt="avatar" className="w-12 h-12 rounded-full object-cover border-2 border-[var(--border-subtle)] group-hover:border-white/40 transition" />
                    <div className="text-left">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-white text-base">{acc.name}</p>
                        {acc.handoffHash && <Sparkles size={12} className="kdr-section-title-accent" />}
                      </div>
                      <p className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Conta Salva</p>
                    </div>
                  </div>
                  <button onClick={(e) => removeSavedAccount(acc.email, e)} className="p-2 text-[var(--text-muted)] hover:text-red-500 transition sm:opacity-0 sm:group-hover:opacity-100 min-w-[44px] min-h-[44px]" title="Remover Conta">
                    <span className="text-xs font-bold uppercase">Remover</span>
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => setShowSavedList(false)}
              className="w-full mt-6 py-3.5 glass-card text-zinc-300 font-bold hover:text-white hover:bg-white/10 rounded-2xl transition flex items-center justify-center gap-2 min-h-[48px]"
            >
              <UserPlus size={18} /> Entrar em outra conta
            </button>
          </div>
        ) : (
          <div className="animate-fadeInUp">
            {selectedAccount && (
              <div className="flex items-center justify-between mb-6 bg-[var(--bg-card)]/60 p-2 pr-4 rounded-full border border-[var(--border-subtle)] shadow-sm">
                <div className="flex items-center gap-3">
                  <img src={selectedAccount.avatar} className="w-10 h-10 rounded-full object-cover" alt="avatar" />
                  <p className="font-bold text-white text-sm">{selectedAccount.email}</p>
                </div>
                {savedAccounts.length > 0 && (
                  <button type="button" onClick={() => { setShowSavedList(true); setSelectedAccount(null); setPassword(""); }} className="text-xs font-bold text-[var(--text-muted)] hover:text-white flex items-center gap-1 transition min-h-[44px]">
                    <ChevronLeft size={14} /> Trocar
                  </button>
                )}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              {!selectedAccount && (
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] mb-1.5 block">E-mail ou Nome de Usuário</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="kdr-input w-full pl-9 pr-4 py-3 rounded-xl text-sm"
                      placeholder="seu@email.com ou seu_usuario"
                    />
                  </div>
                </div>
              )}
              
              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] mb-1.5 block">Senha</label>
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
                  className="kdr-btn-primary w-full h-[52px]"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                  {loading ? "ENTRANDO..." : "ENTRAR"}
                </button>
            </form>
          </div>
        )}



        <p className="mt-8 text-center text-[var(--text-muted)] text-sm">
          Novo no Futuro sem Contexto?{" "}
          <Link href="/register" className="font-bold transition kdr-section-title-accent hover:text-white">
            Cadastrar
          </Link>
        </p>
      </div>
    </div>
  );
}
