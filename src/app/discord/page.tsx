import AppLayout from "@/components/AppLayout";
import { MessageSquare } from "lucide-react";

export default function DiscordPage() {
  return (
    <AppLayout>
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center animate-fadeInUp">
        <div className="w-24 h-24 bg-[#5865F2]/20 border border-[#5865F2] rounded-3xl flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(88,101,242,0.3)]">
          <MessageSquare size={48} className="fill-[#5865F2] text-[#5865F2]" />
        </div>
        
        <h1 className="text-4xl md:text-6xl font-black mb-4 flex flex-col md:flex-row items-center gap-3">
          <span className="text-pink-500">Futuro</span> sem Contexto
        </h1>
        
        <p className="text-xl md:text-2xl font-bold text-[#5865F2] mb-6">
          Servidor Oficial no Discord
        </p>

        <p className="text-zinc-400 max-w-lg mb-12 text-sm leading-relaxed">
          Entre na comunidade oficial! Converse com outros fãs, veja lançamentos, participe de eventos e fique por dentro de tudo.
        </p>

        <a 
          href="https://discord.gg/qcRjvb2My7" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold py-4 px-8 rounded-2xl text-lg transition-all shadow-[0_0_20px_rgba(88,101,242,0.4)] hover:shadow-[0_0_30px_rgba(88,101,242,0.6)] hover:-translate-y-1"
        >
          <MessageSquare size={24} className="fill-white" />
          Entrar no Discord
        </a>
        
        <p className="text-zinc-600 text-xs mt-6 font-mono">discord.gg/qcRjvb2My7</p>
      </div>
    </AppLayout>
  );
}
