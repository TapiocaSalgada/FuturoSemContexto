"use client";

import AppLayout from "@/components/AppLayout";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Bell,
  Check,
  Eye,
  Eye as EyeIcon,
  EyeOff,
  Palette,
  Settings,
  UploadCloud,
  UserCircle,
  LogOut,
  Image as ImageIcon,
  MessageCircle,
} from "lucide-react";
import { signOut } from "next-auth/react";

import { DEFAULT_SETTINGS, type UserSettingsPayload } from "@/lib/settings";

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
  notifications: "Notificacoes",
  appearance: "Aparencia",
  privacy: "Privacidade",
  playback: "Reproducao",
};

function applyTheme(theme: string) {
  const html = document.documentElement;
  html.classList.remove("theme-galactic", "theme-ocean", "theme-matrix");
  if (theme !== "pink") html.classList.add(`theme-${theme}`);
}

function applyReducedMotion(enabled: boolean) {
  document.documentElement.classList.toggle("reduced-motion", enabled);
}

function applyNeon(enabled: boolean) {
  document.documentElement.classList.toggle("neon-off", !enabled);
}

function applyVisualSettings(settings: UserSettingsPayload) {
  applyTheme(settings.theme);
  applyReducedMotion(settings.reducedMotion);
  applyNeon(settings.neonEffects);
}

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const [section, setSection] = useState<Section>("conta");
  const [settings, setSettings] = useState<UserSettingsPayload>(DEFAULT_SETTINGS);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [profileForm, setProfileForm] = useState({
    name: "",
    bio: "",
    avatarUrl: "",
    bannerUrl: "",
  });
  const [profileMsg, setProfileMsg] = useState("");
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "", confirmEmail: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [emailForm, setEmailForm] = useState({ password: "", newEmail: "" });
  const [emailMsg, setEmailMsg] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<{email: string; name: string; avatar: string}[]>([]);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (showAccountsModal) {
      try {
        const saved = JSON.parse(localStorage.getItem('savedAccounts') || '[]');
        setSavedAccounts(saved);
      } catch (e) {}
    }
  }, [showAccountsModal]);

  const persistSettings = useCallback(async (next: UserSettingsPayload) => {
    setSettings(next);
    applyVisualSettings(next);
    setSaveState("saving");

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });

    if (!res.ok) {
      setSaveState("error");
      return;
    }

    setSaveState("saved");
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => setSaveState("idle"), 2000);
  }, []);

  useEffect(() => {
    fetch("/api/settings")
      .then((response) => response.json())
      .then((data) => {
        const next = { ...DEFAULT_SETTINGS, ...data };
        setSettings(next);
        applyVisualSettings(next);
      });
  }, []);

  const PRESET_AVATARS = [
    "https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=ff007f",
    "https://api.dicebear.com/7.x/notionists/svg?seed=Avery&backgroundColor=9333ea",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Jasper&backgroundColor=0ea5e9",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna&backgroundColor=f43f5e",
    "https://api.dicebear.com/7.x/micah/svg?seed=Oliver&backgroundColor=eab308"
  ];

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showAvatarPresets, setShowAvatarPresets] = useState(false);

  useEffect(() => {
    const id = (session?.user as any)?.id;
    if (!id) return;
    fetch(`/api/profile?id=${id}`)
      .then((response) => response.json())
      .then((profile) => {
        if (!profile) return;
        setProfileForm({
          name: profile.name || "",
          bio: profile.bio || "",
          avatarUrl: profile.avatarUrl || "",
          bannerUrl: profile.bannerUrl || "",
        });
      });
  }, [session]);

  useEffect(() => () => clearTimeout(saveTimeout.current), []);

  const toggle = (key: keyof UserSettingsPayload) =>
    persistSettings({ ...settings, [key]: !settings[key] });
  const select = (key: keyof UserSettingsPayload, value: string) =>
    persistSettings({ ...settings, [key]: value });

  const handleSaveProfile = async () => {
    setProfileLoading(true);
    setProfileMsg("");
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileForm),
    });
    if (res.ok) {
      setProfileMsg("Perfil salvo.");
      updateSession();
    } else {
      setProfileMsg("Erro ao salvar.");
    }
    setProfileLoading(false);
    setTimeout(() => setProfileMsg(""), 3000);
  };

  const handleUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    field: "avatarUrl" | "bannerUrl",
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (field === "avatarUrl") setAvatarUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "uploads");
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.url) {
        setProfileForm((current) => ({ ...current, [field]: data.url }));
      }
    } finally {
      if (field === "avatarUrl") setAvatarUploading(false);
    }
  };

  const selectPresetAvatar = (url: string) => {
    setProfileForm((current) => ({ ...current, avatarUrl: url }));
    setShowAvatarPresets(false);
  };

  const handleChangePassword = async () => {
    setPwMsg("");
    if (pwForm.newPw !== pwForm.confirm) {
      setPwMsg("As senhas nao coincidem.");
      return;
    }
    if (pwForm.newPw.length < 6) {
      setPwMsg("Minimo de 6 caracteres.");
      return;
    }

    const res = await fetch("/api/profile/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: pwForm.current,
        newPassword: pwForm.newPw,
        confirmEmail: pwForm.confirmEmail,
      }),
    });

    if (res.ok) {
      setPwMsg("Senha alterada.");
      setPwForm({ current: "", newPw: "", confirm: "", confirmEmail: "" });
    } else {
      const data = await res.json();
      setPwMsg(data.error || "Erro ao alterar senha.");
    }
    setTimeout(() => setPwMsg(""), 4000);
  };

  const handleChangeEmail = async () => {
    setEmailMsg("");
    const res = await fetch("/api/profile/change-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: emailForm.password,
        newEmail: emailForm.newEmail,
      }),
    });
    if (res.ok) {
      setEmailMsg("E-mail atualizado. Faca login novamente.");
      setEmailForm({ password: "", newEmail: "" });
    } else {
      const data = await res.json();
      setEmailMsg(data.error || "Erro ao atualizar e-mail.");
    }
    setTimeout(() => setEmailMsg(""), 4000);
  };

  function Toggle({
    label,
    desc,
    settingKey,
  }: {
    label: string;
    desc?: string;
    settingKey: keyof UserSettingsPayload;
  }) {
    const on = settings[settingKey] as boolean;
    return (
      <div className="flex items-center justify-between gap-4 py-4 border-b border-zinc-800 last:border-0">
        <div>
          <p className="font-semibold text-white text-sm">{label}</p>
          {desc && <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>}
        </div>
        <button
          onClick={() => toggle(settingKey)}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
            on ? "bg-pink-500" : "bg-zinc-700"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
              on ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>
    );
  }

  function SelectField({
    label,
    options,
    settingKey,
  }: {
    label: string;
    options: { label: string; value: string }[];
    settingKey: keyof UserSettingsPayload;
  }) {
    return (
      <div className="flex items-center justify-between gap-4 py-4 border-b border-zinc-800 last:border-0">
        <p className="font-semibold text-white text-sm">{label}</p>
        <select
          value={settings[settingKey] as string}
          onChange={(event) => select(settingKey, event.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-pink-500 transition"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  function InputField({
    label,
    value,
    onChange,
    type = "text",
    placeholder = "",
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
  }) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
          {label}
        </label>
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-zinc-800/70 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink-500 transition"
        />
      </div>
    );
  }

  const userEmail = session?.user?.email || "";
  const [localPart, domain] = userEmail.split("@");
  const censoredEmail = localPart ? `${localPart.substring(0, Math.ceil(localPart.length / 2))}***@${domain || ""}` : "";

  return (
    <AppLayout>
      <div className="p-4 lg:p-10 pb-24 max-w-5xl mx-auto animate-fadeInUp">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3">
            <Settings size={26} className="text-pink-500" /> Configuracoes
          </h1>
          {saveState !== "idle" && (
            <span
              className={`text-sm font-bold animate-fadeIn ${
                saveState === "error"
                  ? "text-red-400"
                  : saveState === "saving"
                    ? "text-zinc-400"
                    : "text-green-400"
              }`}
            >
              {saveState === "saving"
                ? "Salvando..."
                : saveState === "saved"
                  ? "Salvo"
                  : "Erro ao salvar"}
            </span>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-52 shrink-0">
            <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {(Object.keys(sectionLabels) as Section[]).map((key) => {
                const Icon = sectionIcons[key];
                return (
                  <button
                    key={key}
                    onClick={() => setSection(key)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition whitespace-nowrap min-h-[44px] ${
                      section === key
                        ? "bg-pink-600 text-white shadow-[0_0_15px_rgba(255,0,127,0.3)]"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                    }`}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="hidden lg:block">{sectionLabels[key]}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="flex-1 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 lg:p-6">
            <h2 className="text-lg font-bold text-white mb-1">
              {sectionLabels[section]}
            </h2>
            <p className="text-xs text-zinc-500 mb-6">
              {section === "conta"
                ? "Edite seu perfil e credenciais."
                : "Mudancas salvas automaticamente no servidor."}
            </p>

            {section === "conta" && (
              <div className="space-y-8">
                {/* Ações Globais */}
                {/* Ações Globais */}
                <div className="flex gap-3 flex-wrap">
                  <button onClick={() => setShowAccountsModal(true)}
                    className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 border border-zinc-700 hover:border-red-500/50 text-zinc-300 font-bold py-3 rounded-xl transition text-sm">
                    <LogOut size={18} /> Trocar de Conta
                  </button>
                </div>

                {/* Switch Account Modal */}
                {showAccountsModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAccountsModal(false)} />
                    <div className="relative bg-[#1a1a1a] border border-zinc-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fadeInUp">
                      <h3 className="font-bold text-xl text-white mb-6 text-center">Trocar de Conta</h3>
                      
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-1 mb-6">
                        {savedAccounts.filter(a => a.email !== session?.user?.email).map(acc => (
                          <button key={acc.email} onClick={() => signOut({ callbackUrl: `/login?email=${acc.email}` })}
                            className="w-full flex items-center gap-4 p-3 bg-zinc-900/60 border border-zinc-800 hover:border-pink-500 rounded-2xl transition group text-left"
                          >
                            <img src={acc.avatar} className="w-10 h-10 rounded-full object-cover border-2 border-zinc-800 group-hover:border-pink-500 transition" alt="avatar" />
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-white text-sm truncate">{acc.name}</p>
                                <p className="text-[10px] text-zinc-500 truncate">{acc.email}</p>
                            </div>
                          </button>
                        ))}
                        <button onClick={() => signOut({ callbackUrl: '/login' })}
                          className="w-full flex items-center gap-4 p-3 bg-zinc-900/40 border border-zinc-800 border-dashed hover:border-pink-500 rounded-2xl transition group text-left"
                        >
                          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-pink-500 group-hover:bg-pink-500/10 transition">
                            <LogOut size={18} />
                          </div>
                          <p className="font-bold text-zinc-400 group-hover:text-pink-500 text-sm transition">Nova Conta</p>
                        </button>
                      </div>

                      <button onClick={() => setShowAccountsModal(false)} className="w-full py-3 text-zinc-500 hover:text-white font-bold transition text-sm">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <p className="font-bold text-sm text-zinc-300 mb-3 uppercase tracking-wider text-xs">
                    Imagens
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="group cursor-pointer">
                      <div className="w-full aspect-video rounded-xl overflow-hidden border border-zinc-700 group-hover:border-pink-500 transition relative bg-zinc-800">
                        {profileForm.bannerUrl ? (
                          <img
                            src={profileForm.bannerUrl}
                            className="w-full h-full object-cover"
                            alt="Banner"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-zinc-600 text-xs font-bold">
                            BANNER
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <UploadCloud size={22} className="text-white" />
                        </div>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => handleUpload(event, "bannerUrl")}
                      />
                    </label>
                    <div className="flex flex-col items-center gap-3">
                      <label className="group cursor-pointer flex items-center justify-center">
                        <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-zinc-700 group-hover:border-pink-500 transition relative bg-zinc-800">
                          <img
                            src={
                              profileForm.avatarUrl ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                profileForm.name || "U",
                              )}&background=ff007f&color=fff`
                            }
                            className={`w-full h-full object-cover ${avatarUploading ? "opacity-30 blur-sm" : ""}`}
                            alt="Avatar"
                          />
                          {avatarUploading ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-full">
                              <UploadCloud size={18} className="text-white" />
                            </div>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => handleUpload(event, "avatarUrl")}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="font-bold text-sm text-zinc-300 uppercase tracking-wider text-xs">
                    Informacoes
                  </p>
                  <InputField
                    label="Nome de exibicao"
                    value={profileForm.name}
                    onChange={(value) =>
                      setProfileForm((current) => ({ ...current, name: value }))
                    }
                  />
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Bio
                    </label>
                    <textarea
                      value={profileForm.bio}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          bio: event.target.value,
                        }))
                      }
                      placeholder="Sua bio..."
                      className="w-full bg-zinc-800/70 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink-500 transition min-h-[80px] resize-none"
                    />
                  </div>
                  {profileMsg && (
                    <p className="text-sm font-bold text-zinc-300">{profileMsg}</p>
                  )}
                  <button
                    onClick={handleSaveProfile}
                    disabled={profileLoading}
                    className="flex items-center gap-2 bg-pink-600 hover:bg-pink-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition disabled:opacity-50 min-h-[44px]"
                  >
                    <Check size={15} />{" "}
                    {profileLoading ? "Salvando..." : "Salvar Perfil"}
                  </button>
                </div>

                <div className="space-y-3 pt-4 border-t border-zinc-800">
                  <p className="font-bold text-sm text-zinc-300 uppercase tracking-wider text-xs">
                    Alterar Senha
                  </p>
                  <p className="text-xs text-zinc-400 mb-2">Para sua segurança, confirme seu e-mail verdadeiro ({censoredEmail}) para trocar a senha.</p>
                  <InputField
                    label="E-mail de Confirmação"
                    value={pwForm.confirmEmail}
                    onChange={(value) =>
                      setPwForm((current) => ({ ...current, confirmEmail: value }))
                    }
                    type="email"
                    placeholder="Seu e-mail..."
                  />
                  <InputField
                    label="Senha atual"
                    value={pwForm.current}
                    onChange={(value) =>
                      setPwForm((current) => ({ ...current, current: value }))
                    }
                    type="password"
                  />
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Nova senha
                    </label>
                    <div className="relative">
                      <input
                        type={showPw ? "text" : "password"}
                        value={pwForm.newPw}
                        onChange={(event) =>
                          setPwForm((current) => ({
                            ...current,
                            newPw: event.target.value,
                          }))
                        }
                        className="w-full bg-zinc-800/70 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink-500 transition pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                      >
                        {showPw ? <EyeOff size={15} /> : <EyeIcon size={15} />}
                      </button>
                    </div>
                  </div>
                  <InputField
                    label="Confirmar nova senha"
                    value={pwForm.confirm}
                    onChange={(value) =>
                      setPwForm((current) => ({ ...current, confirm: value }))
                    }
                    type="password"
                  />
                  {pwMsg && <p className="text-sm font-bold text-zinc-300">{pwMsg}</p>}
                  <button
                    onClick={handleChangePassword}
                    className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition min-h-[44px]"
                  >
                    Alterar Senha
                  </button>
                </div>

                <div className="space-y-3 pt-4 border-t border-zinc-800">
                  <p className="font-bold text-sm text-zinc-300 uppercase tracking-wider text-xs">
                    Alterar E-mail
                  </p>
                  <InputField
                    label="Senha atual (confirmacao)"
                    value={emailForm.password}
                    onChange={(value) =>
                      setEmailForm((current) => ({ ...current, password: value }))
                    }
                    type="password"
                  />
                  <InputField
                    label="Novo e-mail"
                    value={emailForm.newEmail}
                    onChange={(value) =>
                      setEmailForm((current) => ({ ...current, newEmail: value }))
                    }
                    type="email"
                    placeholder="novo@email.com"
                  />
                  {emailMsg && (
                    <p className="text-sm font-bold text-zinc-300">{emailMsg}</p>
                  )}
                  <button
                    onClick={handleChangeEmail}
                    className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition min-h-[44px]"
                  >
                    Atualizar E-mail
                  </button>
                </div>
              </div>
            )}

            {section === "notifications" && (
              <div>
                <Toggle
                  label="Novos seguidores"
                  desc="Avise quando alguem comecar a seguir seu perfil."
                  settingKey="notifyFollowers"
                />
                <Toggle
                  label="Respostas em comentarios"
                  desc="Avise quando responderem seus comentarios."
                  settingKey="notifyReplies"
                />
              </div>
            )}

            {section === "appearance" && (
              <div>
                <div className="py-4 border-b border-zinc-800">
                  <p className="font-semibold text-white text-sm mb-3">
                    Tema de cores
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "pink", label: "Rosa Neon", color: "bg-pink-600" },
                      {
                        value: "galactic",
                        label: "Roxo Galactic",
                        color: "bg-purple-600",
                      },
                      { value: "ocean", label: "Azul Oceano", color: "bg-sky-600" },
                      { value: "matrix", label: "Verde Matrix", color: "bg-green-600" },
                    ].map((theme) => (
                      <button
                        key={theme.value}
                        onClick={() => select("theme", theme.value)}
                        className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-bold transition ${
                          settings.theme === theme.value
                            ? "border-white bg-zinc-800"
                            : "border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/50"
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full ${theme.color} shrink-0`}
                        />
                        {theme.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Toggle
                  label="Animacoes reduzidas"
                  desc="Diminui a carga visual para uma navegacao mais leve."
                  settingKey="reducedMotion"
                />
                <Toggle
                  label="Efeitos neon"
                  desc="Mantem os brilhos e destaques principais ligados."
                  settingKey="neonEffects"
                />
              </div>
            )}

            {section === "privacy" && (
              <div>
                <Toggle
                  label="Perfil publico"
                  desc="Permite que outras pessoas vejam sua pagina de perfil."
                  settingKey="publicProfile"
                />
                <Toggle
                  label="Mostrar historico"
                  desc="Exibe seu historico recente para outros usuarios."
                  settingKey="showHistory"
                />
                <Toggle
                  label="Permitir seguidores"
                  desc="Aceita novos seguidores no perfil."
                  settingKey="allowFollow"
                />
              </div>
            )}

            {section === "playback" && (
              <div>
                <Toggle
                  label="Reproducao automatica"
                  desc="Inicia o proximo episodio automaticamente quando existir."
                  settingKey="autoplay"
                />
                <Toggle
                  label="Retomar de onde parou"
                  desc="Volta automaticamente para o ultimo ponto salvo."
                  settingKey="resumePlayback"
                />
                <SelectField
                  label="Velocidade padrao"
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
