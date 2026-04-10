"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { useSession } from "next-auth/react";

import { useThemeStore } from "@/lib/theme-store";
import { normalizeTheme } from "@/lib/theme";

function applyTheme(theme: string) {
  document.documentElement.setAttribute("data-theme", normalizeTheme(theme));
}

function applyReducedMotion(enabled: boolean) {
  document.documentElement.classList.toggle("reduced-motion", enabled);
}

function applyNeon(enabled: boolean) {
  document.documentElement.classList.toggle("neon-off", !enabled);
}

function VisualSettingsBoot() {
  const { data: session, status } = useSession();
  const setTheme = useThemeStore((state) => state.setTheme);
  const accountKey = `${(session?.user as any)?.id || ""}:${session?.user?.email || ""}`;

  useEffect(() => {
    try {
      const storedTheme = normalizeTheme(localStorage.getItem("app-theme"));
      applyTheme(storedTheme);
      setTheme(storedTheme);
    } catch {
      applyTheme("futuro-noir");
    }
  }, [setTheme]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let alive = true;

    fetch("/api/settings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        const theme = normalizeTheme(data.theme);
        applyTheme(theme);
        applyReducedMotion(Boolean(data.reducedMotion));
        applyNeon(data.neonEffects !== false);
        try {
          localStorage.setItem("app-theme", theme);
        } catch {
          // ignore localStorage restrictions
        }
        setTheme(theme);
      })
      .catch(() => {
        // keep defaults when request fails
      });

    return () => {
      alive = false;
    };
  }, [status, accountKey, setTheme]);

  return null;
}

function PresenceHeartbeat() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;

    let disposed = false;

    const ping = async () => {
      if (disposed) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        await fetch("/api/presence", {
          method: "POST",
          cache: "no-store",
          keepalive: true,
        });
      } catch {
        // ignore connectivity issues
      }
    };

    void ping();
    const interval = window.setInterval(() => {
      void ping();
    }, 60_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void ping();
      }
    };

    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status]);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <VisualSettingsBoot />
      <PresenceHeartbeat />
      {children}
    </SessionProvider>
  );
}
