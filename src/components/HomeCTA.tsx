"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

export default function HomeCTA() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  if (!isAdmin) return null;

  return (
    <div className="px-6 lg:px-14 py-4">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-white transition border border-[var(--border-subtle)] hover:border-[var(--border-strong)] rounded-lg px-3 py-2"
      >
        ⚙️ Painel Admin
      </Link>
    </div>
  );
}
