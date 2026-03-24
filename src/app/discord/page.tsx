import AppLayout from "@/components/AppLayout";
import Link from "next/link";

export default function DiscordPage() {
  const features = [
    { icon: "💬", title: "Chat em Tempo Real", desc: "Converse com outros fãs durante os episódios" },
    { icon: "📢", title: "Anúncios Exclusivos", desc: "Seja o primeiro a saber das novidades da plataforma" },
    { icon: "🎭", title: "Canais de Anime", desc: "Discussões separadas por série e temporada" },
    { icon: "🎮", title: "Eventos e Sorteios", desc: "Participe de eventos especiais da comunidade" },
    { icon: "🔔", title: "Notificações de Lançamentos", desc: "Saiba quando novos episódios chegarem" },
    { icon: "👥", title: "Comunidade Ativa", desc: "Encontre pessoas com os mesmos gostos que você" },
  ];

  return (
    <AppLayout>
      <div className="pb-24">
        {/* Hero */}
        <div className="relative flex flex-col items-center justify-center py-24 px-8 overflow-hidden">
          {/* Glow bg */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#5865F2]/10 via-transparent to-transparent pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#5865F2]/15 rounded-full blur-3xl pointer-events-none" />

          {/* Discord logo cluster */}
          <div className="relative mb-8">
            <div className="w-28 h-28 bg-[#5865F2] rounded-3xl flex items-center justify-center mx-auto shadow-[0_0_60px_rgba(88,101,242,0.5)] animate-glowPulse">
              <span className="text-6xl select-none">💬</span>
            </div>
            {/* Orbiting icons */}
            <span className="absolute -top-3 -right-3 text-2xl animate-bounce">🎭</span>
            <span className="absolute -bottom-3 -left-3 text-2xl animate-bounce delay-300">🎮</span>
            <span className="absolute -top-3 -left-5 text-xl animate-bounce delay-100">🔔</span>
          </div>

          <h1 className="text-5xl lg:text-6xl font-black text-center mb-4 leading-none">
            <span className="text-pink-500">Futuro</span> sem Contexto
          </h1>
          <h2 className="text-xl text-[#5865F2] font-bold text-center mb-4 tracking-wide">
            Servidor Oficial no Discord
          </h2>
          <p className="text-zinc-400 text-center max-w-md leading-relaxed mb-8">
            Entre na comunidade oficial! Converse com outros fãs, veja lançamentos, participe de eventos e fique por dentro de tudo.
          </p>

          <a
            href="https://discord.gg/qcRjvb2My7"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-black px-10 py-4 rounded-2xl text-lg transition-all duration-300 shadow-[0_0_30px_rgba(88,101,242,0.4)] hover:shadow-[0_0_50px_rgba(88,101,242,0.7)] hover:-translate-y-1"
          >
            <span className="text-2xl">💬</span>
            Entrar no Discord
          </a>
          <p className="text-zinc-600 text-xs mt-4 font-mono">discord.gg/qcRjvb2My7</p>
        </div>

        {/* Features grid */}
        <div className="max-w-4xl mx-auto px-6 lg:px-10 pb-8">
          <h3 className="text-center font-black text-xl mb-8 text-zinc-300">
            O que te espera no servidor 👇
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div
                key={i}
                className="bg-zinc-900/60 border border-zinc-800 hover:border-[#5865F2]/50 rounded-2xl p-5 flex items-start gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(88,101,242,0.1)] animate-fadeInUp"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span className="text-3xl shrink-0">{f.icon}</span>
                <div>
                  <p className="font-bold text-white text-sm">{f.title}</p>
                  <p className="text-zinc-500 text-xs mt-1">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA bottom */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-2 bg-[#5865F2]/10 border border-[#5865F2]/30 rounded-full px-6 py-3 text-[#5865F2] font-bold text-sm">
              <span>🟢</span> Comunidade ativa — entre agora!
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
