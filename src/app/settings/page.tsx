"use client";

import AppLayout from "@/components/AppLayout";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Bell, Eye, Palette, Settings, UserCircle, UploadCloud, Check, Eye as EyeIcon, EyeOff } from "lucide-react";

type Section = "conta" | "notifications" | "appearance" | "privacy" | "playback";

const sectionIcons: Record<Section, React.ElementType> = {
  conta: UserCircle,
  notifications: Bell,
  appearance: Palette,
  privacy: Eye,
  playback: Settings,
};
const sectionLabels: Record<Section, string> = {
  conta: "Conta & Perfil",
  notifications: "Notificações",
  appearance: "Aparência",
  privacy: "Privacidade",
  playback: "Reprodução",
};

type SettingsState = {
  theme: string; reducedMotion: boolean; neonEffects: boolean;
  showHistory: boolean; autoplay: boolean; resumePlayback: boolean;
  publicProfile: boolean; allowFollow: boolean; playbackSpeed: string;
  notifyAnnouncements: boolean; notifyEpisodes: boolean; notifyFollowers: boolean;
};
const DEFAULTS: SettingsState = {
  theme: "pink", reducedMotion: false, neonEffects: true, showHistory: true,
  autoplay: true, resumePlayback: true, publicProfile: true, allowFollow: true,
  playbackSpeed: "Normal", notifyAnnouncements: true, notifyEpisodes: true, notifyFollowers: true,
};

function applyTheme(t: string) {
  const h = document.documentElement; h.classList.remove("theme-galactic", "theme-ocean", "theme-matrix");
  if (t !== "pink") h.classList.add(`theme-${t}`);
}
function applyReducedMotion(v: boolean) { document.documentElement.classList.toggle("reduced-motion", v); }
function applyNeon(v: boolean) { document.documentElement.classList.toggle("neon-off", !v); }

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const [section, setSection] = useState<Section>("conta");
  const [settings, setSettings] = useState<SettingsState>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  // Account editing state
  const [profileForm, setProfileForm] = useState({ name: "", bio: "", avatarUrl: "", bannerUrl: "" });
  const [profileMsg, setProfileMsg] = useState("");
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [emailForm, setEmailForm] = useState({ password: "", newEmail: "" });
  const [emailMsg, setEmailMsg] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("fsc-settings");
    if (stored) { try { const p = JSON.parse(stored); setSettings({ ...DEFAULTS, ...p }); applyTheme(p.theme || "pink"); applyReducedMotion(p.reducedMotion ?? false); applyNeon(p.neonEffects ?? true); } catch {} }
  }, []);

  // Load current profile
  useEffect(() => {
    const id = (session?.user as any)?.id;
    if (id) {
      fetch(`/api/profile?id=${id}`).then(r => r.json()).then(p => {
        if (p) setProfileForm({ name: p.name || "", bio: p.bio || "", avatarUrl: p.avatarUrl || "", bannerUrl: p.bannerUrl || "" });
      });
    }
  }, [session]);

  const savePrefs = useCallback((next: SettingsState) => {
    setSettings(next);
    localStorage.setItem("fsc-settings", JSON.stringify(next));
    applyTheme(next.theme); applyReducedMotion(next.reducedMotion); applyNeon(next.neonEffects);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }, []);

  const toggle = (key: keyof SettingsState) => savePrefs({ ...settings, [key]: !settings[key] });
  const select = (key: keyof SettingsState, value: string) => savePrefs({ ...settings, [key]: value });

  const handleSaveProfile = async () => {
    setProfileLoading(true); setProfileMsg("");
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profileForm) });
    if (res.ok) { setProfileMsg("✅ Perfil salvo!"); updateSession(); }
    else { setProfileMsg("❌ Erro ao salvar."); }
    setProfileLoading(false);
    setTimeout(() => setProfileMsg(""), 3000);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: "avatarUrl" | "bannerUrl") => {
    const f = e.target.files?.[0]; if (!f) return;
    const fd = new FormData(); fd.append("file", f); fd.append("folder", "uploads");
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await r.json(); if (d.url) setProfileForm(pf => ({ ...pf, [field]: d.url }));
  };

  const handleChangePassword = async () => {
    setPwMsg("");
    if (pwForm.newPw !== pwForm.confirm) { setPwMsg("❌ As senhas não coincidem."); return; }
    if (pwForm.newPw.length < 6) { setPwMsg("❌ Mínimo 6 caracteres."); return; }
    const res = await fetch("/api/profile/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.newPw }) });
    if (res.ok) { setPwMsg("✅ Senha alterada!"); setPwForm({ current: "", newPw: "", confirm: "" }); }
    else { const d = await res.json(); setPwMsg(`❌ ${d.error || "Erro."}`); }
    setTimeout(() => setPwMsg(""), 4000);
  };

  const handleChangeEmail = async () => {
    setEmailMsg("");
    const res = await fetch("/api/profile/change-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: emailForm.password, newEmail: emailForm.newEmail }) });
    if (res.ok) { setEmailMsg("✅ E-mail atualizado! Faça login novamente."); setEmailForm({ password: "", newEmail: "" }); }
    else { const d = await res.json(); setEmailMsg(`❌ ${d.error || "Erro."}`); }
    setTimeout(() => setEmailMsg(""), 4000);
  };

  function Toggle({ label, desc, settingKey }: { label: string; desc?: string; settingKey: keyof SettingsState }) {
    const on = settings[settingKey] as boolean;
    return (
      <div className="flex items-center justify-between gap-4 py-4 border-b border-zinc-800 last:border-0">
        <div><p className="font-semibold text-white text-sm">{label}</p>{desc && <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>}</div>
        <button onClick={() => toggle(settingKey)} className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${on ? "bg-pink-500" : "bg-zinc-700"}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${on ? "translate-x-5" : ""}`} />
        </button>
      </div>
    );
  }

  function SelectField({ label, options, settingKey }: { label: string; options: { label: string; value: string }[]; settingKey: keyof SettingsState }) {
    return (
      <div className="flex items-center justify-between gap-4 py-4 border-b border-zinc-800 last:border-0">
        <p className="font-semibold text-white text-sm">{label}</p>
        <select value={settings[settingKey] as string} onChange={e => select(settingKey, e.target.value)} className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-pink-500 transition">
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  function InputField({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{label}</label>
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-zinc-800/70 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink-500 transition" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-10 pb-24 max-w-5xl mx-auto animate-fadeInUp">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3"><Settings size={26} className="text-pink-500" /> Configurações</h1>
          {saved && <span className="text-green-400 text-sm font-bold animate-fadeIn">✅ Salvo</span>}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Nav */}
          <aside className="lg:w-52 shrink-0">
            <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {(Object.keys(sectionLabels) as Section[]).map(s => {
                const Icon = sectionIcons[s];
                return (
                  <button key={s} onClick={() => setSection(s)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition whitespace-nowrap min-h-[44px] ${section === s ? "bg-pink-600 text-white shadow-[0_0_15px_rgba(255,0,127,0.3)]" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}>
                    <Icon size={16} className="shrink-0" /><span className="hidden lg:block">{sectionLabels[s]}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Content */}
          <main className="flex-1 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 lg:p-6">
            <h2 className="text-lg font-bold text-white mb-1">{sectionLabels[section]}</h2>
            <p className="text-xs text-zinc-500 mb-6">
              {section === "conta" ? "Edite seu perfil e credenciais." : "Alterações salvas automaticamente."}
            </p>

            {section === "conta" && (
              <div className="space-y-8">
                {/* Avatar & Banner */}
                <div>
                  <p className="font-bold text-sm text-zinc-300 mb-3 uppercase tracking-wider text-xs">Imagens</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="group cursor-pointer">
                      <div className="w-full aspect-video rounded-xl overflow-hidden border border-zinc-700 group-hover:border-pink-500 transition relative bg-zinc-800">
                        {profileForm.bannerUrl ? <img src={profileForm.bannerUrl} className="w-full h-full object-cover" alt="Banner" /> : <div className="flex items-center justify-center h-full text-zinc-600 text-xs font-bold">BANNER</div>}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"><UploadCloud size={22} className="text-white" /></div>
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e, "bannerUrl")} />
                    </label>
                    <label className="group cursor-pointer flex items-center justify-center">
                      <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-zinc-700 group-hover:border-pink-500 transition relative bg-zinc-800">
                        <img src={profileForm.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileForm.name || "U")}&background=ff007f&color=fff`} className="w-full h-full object-cover" alt="Avatar" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-full"><UploadCloud size={18} className="text-white" /></div>
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e, "avatarUrl")} />
                    </label>
                  </div>
                </div>

                {/* Basic Info */}
                <div className="space-y-3">
                  <p className="font-bold text-sm text-zinc-300 uppercase tracking-wider text-xs">Informações</p>
                  <InputField label="Nome de exibição" value={profileForm.name} onChange={v => setProfileForm(p => ({ ...p, name: v }))} />
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Bio</label>
                    <textarea value={profileForm.bio} onChange={e => setProfileForm(p => ({ ...p, bio: e.target.value }))} placeholder="Sua bio..." className="w-full bg-zinc-800/70 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink-500 transition min-h-[80px] resize-none" />
                  </div>
                  {profileMsg && <p className={`text-sm font-bold ${profileMsg.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>{profileMsg}</p>}
                  <button onClick={handleSaveProfile} disabled={profileLoading} className="flex items-center gap-2 bg-pink-600 hover:bg-pink-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition disabled:opacity-50 min-h-[44px]">
                    <Check size={15} /> {profileLoading ? "Salvando..." : "Salvar Perfil"}
                  </button>
                </div>

                {/* Change Password */}
                <div className="space-y-3 pt-4 border-t border-zinc-800">
                  <p className="font-bold text-sm text-zinc-300 uppercase tracking-wider text-xs">Alterar Senha</p>
                  <InputField label="Senha atual" value={pwForm.current} onChange={v => setPwForm(p => ({ ...p, current: v }))} type="password" />
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Nova senha</label>
                    <div className="relative">
                      <input type={showPw ? "text" : "password"} value={pwForm.newPw} onChange={e => setPwForm(p => ({ ...p, newPw: e.target.value }))} placeholder="" className="w-full bg-zinc-800/70 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink-500 transition pr-10" />
                      <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">{showPw ? <EyeOff size={15} /> : <EyeIcon size={15} />}</button>
                    </div>
                  </div>
                  <InputField label="Confirmar nova senha" value={pwForm.confirm} onChange={v => setPwForm(p => ({ ...p, confirm: v }))} type="password" />
                  {pwMsg && <p className={`text-sm font-bold ${pwMsg.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>{pwMsg}</p>}
                  <button onClick={handleChangePassword} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition min-h-[44px]">
                    Alterar Senha
                  </button>
                </div>

                {/* Change Email */}
                <div className="space-y-3 pt-4 border-t border-zinc-800">
                  <p className="font-bold text-sm text-zinc-300 uppercase tracking-wider text-xs">Alterar E-mail</p>
                  <InputField label="Senha atual (confirmação)" value={emailForm.password} onChange={v => setEmailForm(p => ({ ...p, password: v }))} type="password" />
                  <InputField label="Novo e-mail" value={emailForm.newEmail} onChange={v => setEmailForm(p => ({ ...p, newEmail: v }))} type="email" placeholder="novo@email.com" />
                  {emailMsg && <p className={`text-sm font-bold ${emailMsg.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>{emailMsg}</p>}
                  <button onClick={handleChangeEmail} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition min-h-[44px]">
                    Atualizar E-mail
                  </button>
                </div>
              </div>
            )}

            {section === "notifications" && <div>
              <Toggle label="Anúncios do Admin" desc="Receba notificações de novos anúncios." settingKey="notifyAnnouncements" />
              <Toggle label="Novos Episódios" desc="Seja notificado de novos episódios." settingKey="notifyEpisodes" />
              <Toggle label="Novos Seguidores" desc="Alertas quando alguém te seguir." settingKey="notifyFollowers" />
            </div>}

            {section === "appearance" && <div>
              <div className="py-4 border-b border-zinc-800">
                <p className="font-semibold text-white text-sm mb-3">Tema de Cores</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "pink", label: "🌸 Rosa Neon", color: "bg-pink-600" },
                    { value: "galactic", label: "🔮 Roxo Galáctico", color: "bg-purple-600" },
                    { value: "ocean", label: "🌊 Azul Oceano", color: "bg-sky-600" },
                    { value: "matrix", label: "🟢 Verde Matrix", color: "bg-green-600" },
                  ].map(t => (
                    <button key={t.value} onClick={() => select("theme", t.value)}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-bold transition ${settings.theme === t.value ? "border-white bg-zinc-800" : "border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/50"}`}>
                      <span className={`w-4 h-4 rounded-full ${t.color} shrink-0`} />{t.label}
                    </button>
                  ))}
                </div>
              </div>
              <Toggle label="Animações Reduzidas" desc="Desativa animações para melhorar performance." settingKey="reducedMotion" />
              <Toggle label="Efeitos Neon" desc="Efeitos de brilho nos elementos de destaque." settingKey="neonEffects" />
            </div>}

            {section === "privacy" && <div>
              <Toggle label="Perfil Público" desc="Outros usuários podem ver seu perfil." settingKey="publicProfile" />
              <Toggle label="Mostrar Histórico" desc="Exibir animes assistidos no seu perfil." settingKey="showHistory" />
              <Toggle label="Permitir ser seguido" desc="Permite que outros usuários te sigam." settingKey="allowFollow" />
            </div>}

            {section === "playback" && <div>
              <Toggle label="Reprodução Automática" desc="Próximo episódio inicia automaticamente." settingKey="autoplay" />
              <Toggle label="Retomar de onde parou" desc="Continua o episódio do ponto onde saiu." settingKey="resumePlayback" />
              <SelectField label="Velocidade Padrão" settingKey="playbackSpeed"
                options={[{ label: "0.5x", value: "0.5x" }, { label: "0.75x", value: "0.75x" }, { label: "Normal", value: "Normal" }, { label: "1.25x", value: "1.25x" }, { label: "1.5x", value: "1.5x" }, { label: "2x", value: "2x" }]} />
            </div>}
          </main>
        </div>
      </div>
    </AppLayout>
  );
}
