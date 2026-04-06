"use client";

import AppLayout from "@/components/AppLayout";
import SuggestionButton from "@/components/SuggestionButton";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
  MessageCircle,
  Shield,
} from "lucide-react";
import { signIn, signOut } from "next-auth/react";

import { DEFAULT_SETTINGS, type UserSettingsPayload } from "@/lib/settings";
import { useThemeStore } from "@/lib/theme-store";
import { normalizeTheme } from "@/lib/theme";
import { readSavedAccounts } from "@/lib/saved-accounts";

type Section = "conta" | "notifications" | "appearance" | "privacy" | "playback" | "feedback";

const sectionIcons: Record<Section, React.ElementType> = {
  conta: UserCircle,
  notifications: Bell,
  appearance: Palette,
  privacy: Eye,
  playback: Settings,
  feedback: MessageCircle,
};

const sectionLabels: Record<Section, string> = {
  conta: "Conta & Perfil",
  notifications: "Notificacoes",
  appearance: "Aparencia",
  privacy: "Privacidade",
  playback: "Reproducao",
  feedback: "Reportar bug",
};

function applyTheme(theme: string) {
  const html = document.documentElement;
  html.setAttribute("data-theme", normalizeTheme(theme));
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
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [savedAccounts, setSavedAccounts] = useState<{email: string; name: string; avatar: string; handoffHash?: string}[]>([]);
  const [switchingAccount, setSwitchingAccount] = useState<string | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const targetSection = String(searchParams.get("section") || "").trim().toLowerCase();
    if (targetSection && targetSection in sectionLabels) {
      setSection(targetSection as Section);
    }
  }, [searchParams]);

  useEffect(() => {
    if (showAccountsModal) {
      const saved = readSavedAccounts(8).map((item) => ({
        email: item.email,
        name: item.name,
        avatar:
          item.avatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || item.email)}&background=1f2937&color=fff`,
        handoffHash: item.handoffHash,
      }));
      setSavedAccounts(saved);
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
        setTheme(normalizeTheme(next.theme));
      });
  }, []);

  const PRESET_AVATARS = [
    "https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=111827",
    "https://api.dicebear.com/7.x/notionists/svg?seed=Avery&backgroundColor=334155",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Jasper&backgroundColor=1f2937",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna&backgroundColor=111827",
    "https://api.dicebear.com/7.x/micah/svg?seed=Oliver&backgroundColor=374151"
  ];

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showAvatarPresets, setShowAvatarPresets] = useState(false);

  const { theme, setTheme } = useThemeStore();

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
  const select = (key: keyof UserSettingsPayload, value: string) => {
    const normalizedValue = key === "theme" ? normalizeTheme(value) : value;
    persistSettings({ ...settings, [key]: normalizedValue });
    if (key === "theme") setTheme(normalizedValue);
  };

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

  const handleSwitchAccount = async (account: { email: string; handoffHash?: string }) => {
    if (!account.email) return;
    setSwitchingAccount(account.email);

    try {
      if (account.handoffHash) {
        const quick = await signIn("credentials", {
          email: account.email,
          password: account.handoffHash,
          isQuick: "true",
          redirect: false,
        });

        if (!quick?.error) {
          setShowAccountsModal(false);
          router.push("/");
          router.refresh();
          return;
        }
      }

      await signOut({ callbackUrl: `/login?email=${encodeURIComponent(account.email)}` });
    } finally {
      setSwitchingAccount(null);
    }
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
            on ? "bg-zinc-200" : "bg-zinc-700"
          }`}
          style={on ? { boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 28%, transparent), 0 0 18px color-mix(in srgb, var(--accent) 24%, transparent)" } : undefined}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 ${on ? "bg-black" : "bg-white"} rounded-full shadow transition-transform duration-200 ${
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
          className="bg-black/35 border border-white/12 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-white/30 transition"
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
          className="w-full bg-black/35 border border-white/12 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/30 transition"
        />
      </div>
    );
  }

  const userEmail = session?.user?.email || "";
  const isAdmin = (session?.user as any)?.role === "admin";
  const [localPart, domain] = userEmail.split("@");
  const censoredEmail = localPart ? `${localPart.substring(0, Math.ceil(localPart.length / 2))}***@${domain || ""}` : "";

  return (
    <AppLayout>
      <div className="p-4 lg:p-10 pb-24 max-w-6xl mx-auto animate-fadeInUp">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl lg:text-5xl font-black tracking-tight flex items-center gap-3">
            <Settings size={28} className="kdr-section-title-accent" /> Configuracoes
          </h1>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/20 bg-white/10 text-[11px] sm:text-xs font-black text-[var(--text-primary)] hover:bg-white/14 transition min-h-[44px]"
              >
                <Shield size={14} /> Admin
              </Link>
            )}
            {saveState !== "idle" && (
              <span
                className={`text-sm font-bold animate-fadeIn ${
                  saveState === "error"
                    ? "text-zinc-300"
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
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition whitespace-nowrap min-h-[44px] border ${
                      section === key
                        ? "text-white border-white/35 bg-white/12"
                        : "text-zinc-400 border-transparent hover:text-white hover:bg-white/8"
                    }`}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="hidden lg:block">{sectionLabels[key]}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="flex-1 glass-surface border border-white/10 rounded-2xl p-5 lg:p-6">
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
                    className="flex-1 flex items-center justify-center gap-2 bg-black/35 hover:bg-white/10 hover:text-white border border-white/12 hover:border-white/30 text-zinc-300 font-bold py-3 rounded-xl transition text-sm">
                    <LogOut size={18} /> Trocar de Conta
                  </button>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="flex-1 flex items-center justify-center gap-2 bg-black/35 hover:bg-white/10 border border-white/12 text-zinc-200 font-bold py-3 rounded-xl transition text-sm"
                    >
                      <Shield size={18} /> Painel Admin
                    </Link>
                  )}
                </div>

                {/* Switch Account Modal */}
                {showAccountsModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAccountsModal(false)} />
                    <div className="relative glass-surface-heavy border border-white/12 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fadeInUp">
                      <h3 className="font-bold text-xl text-white mb-6 text-center">Trocar de Conta</h3>
                      
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-1 mb-6">
                        {savedAccounts.filter(a => a.email !== session?.user?.email).map(acc => (
                          <button
                            key={acc.email}
                            onClick={() => handleSwitchAccount(acc)}
                            disabled={switchingAccount === acc.email}
                            className="w-full flex items-center gap-4 p-3 bg-black/35 border border-white/12 hover:border-white/35 rounded-2xl transition group text-left disabled:opacity-60 disabled:cursor-wait"
                          >
                            <img src={acc.avatar} className="w-10 h-10 rounded-full object-cover border-2 border-zinc-800 group-hover:border-white/45 transition" alt="avatar" />
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-white text-sm truncate">{acc.name}</p>
                                <p className="text-[10px] text-zinc-500 truncate">{acc.email}</p>
                            </div>
                            {switchingAccount === acc.email && (
                              <span className="text-[10px] font-bold kdr-section-title-accent uppercase">Entrando...</span>
                            )}
                          </button>
                        ))}
                        <button onClick={() => signOut({ callbackUrl: '/login' })}
                          className="w-full flex items-center gap-4 p-3 bg-black/20 border border-white/12 border-dashed hover:border-white/35 rounded-2xl transition group text-left"
                        >
                          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-white group-hover:bg-white/10 transition">
                            <LogOut size={18} />
                          </div>
                          <p className="font-bold text-zinc-400 group-hover:text-white text-sm transition">Nova Conta</p>
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
                      <div className="w-full aspect-video rounded-xl overflow-hidden border border-zinc-700 group-hover:border-white/45 transition relative bg-zinc-800">
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
                      <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-zinc-700 group-hover:border-white/45 transition relative bg-zinc-800">
                          <img
                            src={
                              profileForm.avatarUrl ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                profileForm.name || "U",
                              )}&background=111827&color=fff`
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
                      className="w-full bg-black/35 border border-white/12 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/30 transition min-h-[80px] resize-none"
                    />
                  </div>
                  {profileMsg && (
                    <p className="text-sm font-bold text-zinc-300">{profileMsg}</p>
                  )}
                  <button
                    onClick={handleSaveProfile}
                    disabled={profileLoading}
                    className="flex items-center gap-2 bg-white hover:bg-zinc-100 text-black font-black px-5 py-2.5 rounded-full text-sm transition disabled:opacity-50 min-h-[44px]"
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
                        className="w-full bg-black/35 border border-white/12 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/30 transition pr-10"
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
                    className="flex items-center gap-2 bg-black/35 hover:bg-white/10 border border-white/12 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition min-h-[44px]"
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
                    className="flex items-center gap-2 bg-black/35 hover:bg-white/10 border border-white/12 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition min-h-[44px]"
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
                <div className="py-4 border-b border-zinc-800 space-y-4">
                  <div>
                    <p className="font-semibold text-white text-sm mb-3">
                      Tema de cores
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { value: "kandaraku-dark", label: "Preto", color: "bg-black" },
                        { value: "kandaraku-light", label: "Branco", color: "bg-white border border-zinc-300" },
                      ].map((t) => (
                        <button
                          key={t.value}
                          onClick={() => { select("theme", t.value); setTheme(t.value); }}
                          className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-bold transition ${
                            normalizeTheme(settings.theme || theme) === t.value
                              ? "border-white/40 bg-white/10"
                              : "border-white/10 hover:border-white/25 hover:bg-white/6"
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded-full ${t.color} shrink-0`}
                          />
                          {t.label}
                        </button>
                      ))}
                    </div>
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
                  label="Participar do social"
                  desc="Mostra suas atividades para amigos no feed social. Vem ligado por padrao."
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
                  label="Auto proximo episodio"
                  desc="Quando um episodio termina, inicia o proximo sozinho."
                  settingKey="autoplay"
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

            {section === "feedback" && (
              <div className="space-y-4">
                <p className="text-sm text-zinc-400">
                  Envie sugestoes de anime e reporte bugs do site. Voce tambem encontra esse atalho no menu ao tocar na foto de perfil.
                </p>
                <SuggestionButton
                  variant="sidebar"
                  mobileSidebar={true}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/15 bg-white/5 text-white font-semibold hover:bg-white/10 transition"
                />
                <p className="text-xs text-zinc-500">
                  Para bug específico de player, use também o botão &quot;Reportar bug&quot; dentro da tela de episódio.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </AppLayout>
  );
}
