import AppLayout from "@/components/AppLayout";

export default function DiscordPage() {
  return (
    <AppLayout>
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center animate-fadeInUp">
        {/* Real Discord logo from public/discord.png */}
        <div className="w-28 h-28 rounded-3xl flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(88,101,242,0.4)] overflow-hidden border border-[#5865F2]/30">
          <img
            src="/discord.png"
            alt="Discord"
            className="w-full h-full object-contain p-3"
            loading="eager"
          />
        </div>

        <h1 className="text-4xl md:text-6xl font-black mb-4 flex flex-col md:flex-row items-center gap-3">
          <span className="text-pink-500">Futuro</span> sem Contexto
        </h1>

        <p className="text-xl md:text-2xl font-bold text-[#5865F2] mb-4">
          Servidor Oficial no Discord
        </p>

        <p className="text-zinc-400 max-w-lg mb-10 text-sm leading-relaxed">
          Entre pra comunidade! Fique por dentro de novidades, episódios novos e bate-papo com o pessoal.
        </p>

        <a
          href="https://discord.gg/qcRjvb2My7"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3c46b0] text-white font-bold py-4 px-10 rounded-2xl text-lg transition-all shadow-[0_0_20px_rgba(88,101,242,0.4)] hover:shadow-[0_0_35px_rgba(88,101,242,0.65)] hover:-translate-y-1"
        >
          <img src="/discord.png" alt="" className="w-6 h-6 object-contain" aria-hidden="true" />
          Entrar no Discord
        </a>

        <p className="text-zinc-600 text-xs mt-6 font-mono">discord.gg/qcRjvb2My7</p>
      </div>
    </AppLayout>
  );
}
