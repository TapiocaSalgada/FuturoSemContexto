"use client";

import AppLayout from "@/components/AppLayout";
import { useState } from "react";
import { Settings, Bell, Eye, Palette, Globe, Accessibility, Shield, Info } from "lucide-react";

type Section = "notifications" | "appearance" | "privacy" | "playback" | "accessibility" | "language" | "about";

const sectionIcons: Record<Section, React.ElementType> = {
  notifications: Bell,
  appearance: Palette,
  privacy: Eye,
  playback: Settings,
  accessibility: Accessibility,
  language: Globe,
  about: Info,
};

const sectionLabels: Record<Section, string> = {
  notifications: "Notificações",
  appearance: "Aparência",
  privacy: "Privacidade",
  playback: "Reprodução",
  accessibility: "Acessibilidade",
  language: "Idioma e Região",
  about: "Sobre o App",
};

function Toggle({ label, desc, defaultChecked = false }: { label: string; desc?: string; defaultChecked?: boolean }) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-zinc-800 last:border-0">
      <div>
        <p className="font-semibold text-white text-sm">{label}</p>
        {desc && <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>}
      </div>
      <button onClick={() => setOn(!on)} className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${on ? "bg-pink-500" : "bg-zinc-700"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${on ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

function Select({ label, options, defaultValue }: { label: string; options: string[]; defaultValue?: string }) {
  const [val, setVal] = useState(defaultValue || options[0]);
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-zinc-800 last:border-0">
      <p className="font-semibold text-white text-sm">{label}</p>
      <select value={val} onChange={e => setVal(e.target.value)} className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-pink-500 transition">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("notifications");

  return (
    <AppLayout>
      <div className="p-6 lg:p-10 pb-24 max-w-5xl mx-auto">
        <h1 className="text-3xl font-black mb-8">Configurações</h1>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Nav */}
          <aside className="lg:w-52 shrink-0">
            <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {(Object.keys(sectionLabels) as Section[]).map(s => {
                const Icon = sectionIcons[s];
                return (
                  <button key={s} onClick={() => setSection(s)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition whitespace-nowrap ${section === s ? "bg-pink-600 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}>
                    <Icon size={16} className="shrink-0" />
                    <span className="hidden lg:block">{sectionLabels[s]}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Content */}
          <main className="flex-1 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-2">{sectionLabels[section]}</h2>
            <p className="text-xs text-zinc-500 mb-6">Personalize sua experiência no Futuro sem Contexto.</p>

            {section === "notifications" && (
              <div>
                <Toggle label="Anúncios do Admin" desc="Receba notificações quando houver novos anúncios." defaultChecked />
                <Toggle label="Novos Episódios" desc="Seja notificado quando novos episódios forem adicionados." defaultChecked />
                <Toggle label="Novos Seguidores" desc="Receba alertas quando alguém te seguir." defaultChecked />
                <Toggle label="Comentários nos seus animes" desc="Alertas de comentários em animes que você favoritou." />
              </div>
            )}

            {section === "appearance" && (
              <div>
                <Select label="Tema" options={["Escuro (Padrão)", "Escuro Puro", "AMOLED"]} defaultValue="Escuro (Padrão)" />
                <Select label="Tamanho da Fonte" options={["Pequeno", "Normal", "Grande"]} defaultValue="Normal" />
                <Toggle label="Animações Reduzidas" desc="Desativa animações para melhorar performance." />
                <Toggle label="Efeitos Neon" desc="Efeitos luminosos nos elementos de destaque." defaultChecked />
              </div>
            )}

            {section === "privacy" && (
              <div>
                <Toggle label="Perfil Público" desc="Outros usuários podem ver seu perfil." defaultChecked />
                <Toggle label="Mostrar Histórico" desc="Mostrar no perfil os animes que você assistiu." />
                <Toggle label="Mostrar Seguindo/Seguidores" desc="Exibir contagem de follows no seu perfil." defaultChecked />
                <Toggle label="Permitir ser seguido" desc="Permita que outros usuários te sigam." defaultChecked />
              </div>
            )}

            {section === "playback" && (
              <div>
                <Toggle label="Reprodução Automática" desc="Próximo episódio inicia automaticamente ao final." defaultChecked />
                <Toggle label="Retomar de onde parou" desc="Continua o episódio do ponto onde você saiu." defaultChecked />
                <Select label="Velocidade Padrão" options={["0.5x", "0.75x", "Normal", "1.25x", "1.5x", "2x"]} defaultValue="Normal" />
                <Toggle label="Pular Intro Automático" desc="Pula a abertura automaticamente quando disponível." />
              </div>
            )}

            {section === "accessibility" && (
              <div>
                <Toggle label="Legendas por padrão" desc="Ativa legendas automaticamente nos vídeos." />
                <Select label="Tamanho das Legendas" options={["Pequeno", "Normal", "Grande", "Muito Grande"]} defaultValue="Normal" />
                <Toggle label="Alto Contraste" desc="Aumenta o contraste para melhor visibilidade." />
                <Toggle label="Descrição de Áudio" desc="Narra os elementos visuais da tela." />
              </div>
            )}

            {section === "language" && (
              <div>
                <Select label="Idioma da Interface" options={["Português (BR)", "English", "Español"]} defaultValue="Português (BR)" />
                <Select label="Idioma das Legendas" options={["Português (BR)", "English", "Español", "Japonês"]} defaultValue="Português (BR)" />
                <Select label="Formato de Data" options={["DD/MM/AAAA", "MM/DD/AAAA", "AAAA-MM-DD"]} defaultValue="DD/MM/AAAA" />
              </div>
            )}

            {section === "about" && (
              <div className="space-y-4 text-sm text-zinc-400">
                <div className="flex justify-between py-3 border-b border-zinc-800"><span>Versão</span><span className="text-white font-bold">1.0.0</span></div>
                <div className="flex justify-between py-3 border-b border-zinc-800"><span>Plataforma</span><span className="text-white font-bold">Web</span></div>
                <div className="flex justify-between py-3 border-b border-zinc-800"><span>Desenvolvido por</span><span className="text-pink-500 font-bold">Futuro sem Contexto</span></div>
                <div className="pt-2">
                  <a href="https://discord.gg/qcRjvb2My7" target="_blank" rel="noreferrer" className="text-pink-500 hover:underline">Comunidade no Discord</a>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </AppLayout>
  );
}
