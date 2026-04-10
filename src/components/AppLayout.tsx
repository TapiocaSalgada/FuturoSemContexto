"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import PageTransition from "@/components/PageTransition";

type MaintenanceState = {
  enabled: boolean;
  message?: string;
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [maintenance, setMaintenance] = useState<MaintenanceState>({ enabled: false });

  useEffect(() => {
    let alive = true;

    async function loadMaintenance() {
      try {
        const res = await fetch("/api/system/maintenance", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (alive) setMaintenance({ enabled: Boolean(data?.enabled), message: data?.message || "" });
      } catch {
        // keep app usable if check fails
      }
    }

    loadMaintenance();
    const interval = setInterval(loadMaintenance, 60000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const isAdmin = (session?.user as any)?.role === "admin";
  const isCinemaContext = pathname?.startsWith("/anime/") || pathname?.startsWith("/watch/") || false;
  const hideBottomNav = isCinemaContext;

  if (maintenance.enabled && status !== "loading" && !isAdmin) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-3xl border border-[var(--accent-border)] bg-[var(--surface-0)] p-8 text-center space-y-4 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
          <p className="text-xs font-black uppercase tracking-[0.25em]" style={{ color: "var(--accent-strong)" }}>
            Modo Manutencao
          </p>
          <h1 className="text-3xl font-black">Estamos ajustando o Futuro</h1>
          <p className="text-[var(--text-muted)] text-sm">
            {maintenance.message || "Voltamos em breve. Obrigado pela paciencia!"}
          </p>
          <p className="text-[11px] text-[var(--text-muted)]/60">Acesso temporario liberado apenas para administradores.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell text-[var(--text-primary)]">
      <div className="ambient-backdrop" />

      <div className="relative z-10 min-h-dvh flex flex-col min-w-0">
        <Header cinematic={isCinemaContext} />
        <main
          className={`app-main flex-1 overflow-y-auto scrollbar-hide relative ${
            isCinemaContext
              ? "pt-[calc(56px+env(safe-area-inset-top,0px))]"
              : "pt-[calc(66px+env(safe-area-inset-top,0px))]"
          } ${
            hideBottomNav
              ? "pb-6"
              : "pb-[calc(86px+env(safe-area-inset-bottom,0px))] md:pb-8"
          }`}
        >
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
