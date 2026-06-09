import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { Compass, Play, ShieldCheck } from "lucide-react";

import { authOptions } from "@/lib/auth";

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) redirect("/inicio");

  return (
    <main className="landing-page">
      <section className="landing-card">
        <p className="eyebrow">Futuro sem Contexto</p>
        <h1>Streaming de anime gratuito, escuro e direto ao ponto.</h1>
        <p>
          Entre para acessar catálogo, progresso, lista, perfil e player próprio. A plataforma está preparada para uma nova fase visual preta e roxa.
        </p>
        <div className="hero-actions">
          <Link className="primary-action" href="/login">
            <Play aria-hidden size={18} />
            Entrar e assistir
          </Link>
          <Link className="secondary-action" href="/explorar">
            <Compass aria-hidden size={18} />
            Ver catálogo público
          </Link>
        </div>
        <div className="landing-points">
          <span><ShieldCheck aria-hidden size={16} /> APIs e usuários preservados</span>
          <span>Player com progresso</span>
          <span>Admin operacional</span>
        </div>
      </section>
    </main>
  );
}
