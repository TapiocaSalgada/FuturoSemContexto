import AppLayout from "@/components/AppLayout";
import { Heart, Shield, Tv, Star, Users, Zap } from "lucide-react";

export default function AboutPage() {
  const features = [
    { icon: Tv, title: "Streaming Premium", desc: "Assista seus animes e séries favoritas com um player de alta qualidade, sem interrupções." },
    { icon: Star, title: "Minha Lista", desc: "Organize seus favoritos em pastas personalizadas e acesse facilmente o que você ama." },
    { icon: Users, title: "Comunidade", desc: "Perfis públicos, seguidores, comentários e interação — conecte-se com outros fãs." },
    { icon: Shield, title: "Plataforma Segura", desc: "Administração completa com controle de acesso, anúncios e moderação de usuários." },
    { icon: Zap, title: "Em Alta", desc: "Descubra o que a galera está assistindo com nossas seções de trending em tempo real." },
    { icon: Heart, title: "Feito com Amor", desc: "Um projeto pessoal criado com dedicação para os fãs de cultura pop e anime." },
  ];

  return (
    <AppLayout>
      <div className="p-8 lg:p-16 pb-24 max-w-5xl mx-auto space-y-16">
        {/* Hero */}
        <div className="text-center space-y-4 pt-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Heart className="text-pink-500 w-12 h-12 fill-pink-500 drop-shadow-[0_0_12px_#ff007f]" />
          </div>
          <h1 className="text-5xl font-black">
            <span className="text-pink-500">Futuro</span> sem Contexto
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Uma plataforma de streaming pessoal, criada do zero, para reunir animes, séries e comunidade num só lugar.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="bg-zinc-900/50 border border-zinc-800 hover:border-pink-500/30 rounded-2xl p-6 transition group">
                <div className="w-10 h-10 bg-pink-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-pink-500/20 transition">
                  <Icon size={20} className="text-pink-500" />
                </div>
                <h3 className="font-bold text-white mb-2">{f.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Terms / Legal */}
        <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-8 space-y-6">
          <h2 className="text-2xl font-black text-white">Termos de Uso</h2>
          <div className="text-zinc-400 text-sm space-y-4 leading-relaxed">
            <p>Este é um projeto pessoal e privado. O conteúdo disponível é controlado pelo administrador da plataforma.</p>
            <p>Para usar a plataforma, você deve ter uma conta registrada. O cadastro é por convite ou pelos meios definidos pelo administrador.</p>
            <p>É proibido compartilhar conteúdo inadequado, assediar outros usuários ou tentar comprometer a segurança da plataforma.</p>
            <p>O administrador reserva-se o direito de remover usuários ou conteúdos sem aviso prévio, caso haja violação das regras da comunidade.</p>
          </div>

          <h2 className="text-2xl font-black text-white pt-2">Privacidade</h2>
          <div className="text-zinc-400 text-sm space-y-4 leading-relaxed">
            <p>Coletamos apenas as informações necessárias para o funcionamento da plataforma: nome, email e dados de visualização (histórico e favoritos).</p>
            <p>Nenhum dado é compartilhado com terceiros. Os dados são armazenados localmente e usados exclusivamente para personalizar sua experiência.</p>
            <p>Você pode excluir sua conta a qualquer momento entrando em contato com o administrador.</p>
          </div>
        </div>

        {/* Contact */}
        <div className="text-center space-y-3 text-zinc-500 text-sm">
          <p>Dúvidas? Entre em contato pelo servidor no Discord.</p>
          <a href="https://discord.gg/qcRjvb2My7" target="_blank" rel="noopener noreferrer" className="text-pink-500 hover:underline font-bold">discord.gg/qcRjvb2My7</a>
        </div>
      </div>
    </AppLayout>
  );
}
