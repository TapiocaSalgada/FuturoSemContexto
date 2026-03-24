import AppLayout from "@/components/AppLayout";
import { Heart, Github, MessageSquare } from "lucide-react";
import Link from "next/link";

export default function DiscordPage() {
  return (
    <AppLayout>
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-lg w-full text-center space-y-8">
          <div className="w-24 h-24 bg-[#5865F2]/20 border border-[#5865F2]/30 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <MessageSquare size={40} className="text-[#5865F2]" />
          </div>
          <div>
            <h1 className="text-4xl font-black mb-3">
              <span className="text-pink-500">Futuro</span> sem Contexto
            </h1>
            <p className="text-zinc-400 leading-relaxed">
              Entre na comunidade oficial do Futuro sem Contexto! Converse com outros fãs, veja os lançamentos mais recentes, e fique por dentro das novidades da plataforma.
            </p>
          </div>
          <a
            href="https://discord.gg/qcRjvb2My7"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-black px-8 py-4 rounded-2xl text-lg transition shadow-[0_0_30px_rgba(88,101,242,0.4)] hover:shadow-[0_0_40px_rgba(88,101,242,0.6)]"
          >
            <MessageSquare size={22} />
            Entrar no Discord
          </a>
          <p className="text-zinc-600 text-xs">
            discord.gg/qcRjvb2My7
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
