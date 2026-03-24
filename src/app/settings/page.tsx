"use client";

import AppLayout from "@/components/AppLayout";
import { useState, useEffect, useCallback } from "react";
import { Bell, Eye, Palette, Settings, Heart } from "lucide-react";

type Section = "notifications" | "appearance" | "privacy" | "playback";

const sectionIcons: Record<Section, React.ElementType> = {
  notifications: Bell,
  appearance: Palette,
  privacy: Eye,
  playback: Settings,
};

const sectionLabels: Record<Section, string> = {
  notifications: "Notificações",
  appearance: "Aparência",
  privacy: "Privacidade",
  playback: "Reprodução",
};

type SettingsState = {
  theme: string;
  reducedMotion: boolean;
  neonEffects: boolean;
  showHistory: boolean;
  autoplay: boolean;
  resumePlayback: boolean;
  publicProfile: boolean;
  allowFollow: boolean;
  playbackSpeed: string;
  notifyAnnouncements: boolean;
  notifyEpisodes: boolean;
  notifyFollowers: boolean;
};

const DEFAULTS: SettingsState = {
  theme: "pink",
  reducedMotion: false,
  neonEffects: true,
  showHistory: true,
  autoplay: true,
  resumePlayback: true,
  publicProfile: true,
  allowFollow: true,
  playbackSpeed: "Normal",
  notifyAnnouncements: true,
  notifyEpisodes: true,
  notifyFollowers: true,
};

function applyTheme(theme: string) {
  const html = document.documentElement;
  html.classList.remove("theme-galactic", "theme-ocean", "theme-matrix");
  if (theme !== "pink") html.classList.add(`theme-${theme}`);
}

function applyReducedMotion(val: boolean) {
  document.documentElement.classList.toggle("reduced-motion", val);
}

function applyNeon(val: boolean) {
  document.documentElement.classList.toggle("neon-off", !val);
}

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("appearance");
  const [settings, setSettings] = useState<SettingsState>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("fsc-settings");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULTS, ...parsed });
        applyTheme(parsed.theme || "pink");
        applyReducedMotion(parsed.reducedMotion ?? false);
        applyNeon(parsed.neonEffects ?? true);
      } catch { /* ignore */ }
    }
  }, []);

  const save = useCallback((next: SettingsState) => {
    setSettings(next);
    localStorage.setItem("fsc-settings", JSON.stringify(next));
    applyTheme(next.theme);
    applyReducedMotion(next.reducedMotion);
    applyNeon(next.neonEffects);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  const toggle = (key: keyof SettingsState) => {
    const next = { ...settings, [key]: !settings[key as keyof SettingsState] };
    save(next);
  };

  const select = (key: keyof SettingsState, value: string) => {
    const next = { ...settings, [key]: value };
    save(next);
  };

  function Toggle({ label, desc, settingKey, defaultChecked }: { label: string; desc?: string; settingKey: keyof SettingsState; defaultChecked?: boolean }) {
    const on = settings[settingKey] as boolean;
    return (
      <div className="flex items-center justify-between gap-4 py-4 border-b border-zinc-800 last:border-0">
        <div>
          <p className="font-semibold text-white text-sm">{label}</p>
          {desc && <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>}
        </div>
        <button
          onClick={() => toggle(settingKey)}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${on ? "bg-pink-500" : "bg-zinc-700"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${on ? "translate-x-5" : ""}`} />
        </button>
      </div>
    );
  }

  function SelectField({ label, options, settingKey }: { label: string; options: { label: string; value: string }[]; settingKey: keyof SettingsState }) {
    return (
      <div className="flex items-center justify-between gap-4 py-4 border-b border-zinc-800 last:border-0">
        <p className="font-semibold text-white text-sm">{label}</p>
        <select
          value={settings[settingKey] as string}
          onChange={e => select(settingKey, e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-pink-500 transition"
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-10 pb-24 max-w-5xl mx-auto animate-fadeInUp">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-black flex items-center gap-3">
            <Settings size={28} className="text-pink-500" /> Configurações
          </h1>
          {saved && (
            <span className="text-green-400 text-sm font-bold flex items-center gap-2 animate-fadeIn">
              ✅ Salvo automaticamente
            </span>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Nav */}
          <aside className="lg:w-52 shrink-0">
            <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {(Object.keys(sectionLabels) as Section[]).map(s => {
                const Icon = sectionIcons[s];
                return (
                  <button key={s} onClick={() => setSection(s)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition whitespace-nowrap ${section === s ? "bg-pink-600 text-white shadow-[0_0_15px_rgba(255,0,127,0.3)]" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}>
                    <Icon size={16} className="shrink-0" />
                    <span className="hidden lg:block">{sectionLabels[s]}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Content */}
          <main className="flex-1 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-1">{sectionLabels[section]}</h2>
            <p className="text-xs text-zinc-500 mb-6">Alterações são salvas automaticamente.</p>

            {section === "notifications" && (
              <div>
                <Toggle label="Anúncios do Admin" desc="Receba notificações de novos anúncios." settingKey="notifyAnnouncements" />
                <Toggle label="Novos Episódios" desc="Seja notificado de novos episódios." settingKey="notifyEpisodes" />
                <Toggle label="Novos Seguidores" desc="Alertas quando alguém te seguir." settingKey="notifyFollowers" />
              </div>
            )}

            {section === "appearance" && (
              <div>
                <div className="py-4 border-b border-zinc-800">
                  <p className="font-semibold text-white text-sm mb-3">Tema de Cores</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "pink", label: "🌸 Rosa Neon", color: "bg-pink-600" },
                      { value: "galactic", label: "🔮 Roxo Galáctico", color: "bg-purple-600" },
                      { value: "ocean", label: "🌊 Azul Oceano", color: "bg-sky-600" },
                      { value: "matrix", label: "🟢 Verde Matrix", color: "bg-green-600" },
                    ].map(t => (
                      <button
                        key={t.value}
                        onClick={() => select("theme", t.value)}
                        className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-bold transition ${settings.theme === t.value ? "border-white bg-zinc-800" : "border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/50"}`}
                      >
                        <span className={`w-4 h-4 rounded-full ${t.color} shrink-0`} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Toggle label="Animações Reduzidas" desc="Desativa animações para melhorar performance." settingKey="reducedMotion" />
                <Toggle label="Efeitos Neon" desc="Efeitos de brilho nos elementos de destaque." settingKey="neonEffects" />
              </div>
            )}

            {section === "privacy" && (
              <div>
                <Toggle label="Perfil Público" desc="Outros usuários podem ver seu perfil." settingKey="publicProfile" />
                <Toggle label="Mostrar Histórico" desc="Exibir animes assistidos no seu perfil." settingKey="showHistory" />
                <Toggle label="Permitir ser seguido" desc="Permite que outros usuários te sigam." settingKey="allowFollow" />
              </div>
            )}

            {section === "playback" && (
              <div>
                <Toggle label="Reprodução Automática" desc="Próximo episódio inicia automaticamente." settingKey="autoplay" />
                <Toggle label="Retomar de onde parou" desc="Continua o episódio do ponto onde saiu." settingKey="resumePlayback" />
                <SelectField
                  label="Velocidade Padrão"
                  settingKey="playbackSpeed"
                  options={[
                    { label: "0.5x", value: "0.5x" },
                    { label: "0.75x", value: "0.75x" },
                    { label: "Normal", value: "Normal" },
                    { label: "1.25x", value: "1.25x" },
                    { label: "1.5x", value: "1.5x" },
                    { label: "2x", value: "2x" },
                  ]}
                />
              </div>
            )}
          </main>
        </div>
      </div>
    </AppLayout>
  );
}
