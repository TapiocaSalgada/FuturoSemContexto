"use client";

import { useEffect, useState } from "react";

type SettingsState = {
  autoplay: boolean;
  resumePlayback: boolean;
  publicProfile: boolean;
  showHistory: boolean;
  notifyEpisodes: boolean;
  reducedMotion: boolean;
};

const defaults: SettingsState = {
  autoplay: false,
  resumePlayback: true,
  publicProfile: true,
  showHistory: true,
  notifyEpisodes: true,
  reducedMotion: false,
};

export default function SettingsClient() {
  const [settings, setSettings] = useState<SettingsState>(defaults);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((response) => response.json())
      .then((payload) => setSettings({ ...defaults, ...payload }))
      .catch(() => setStatus("Nao foi possivel carregar ajustes."));
  }, []);

  async function update(next: SettingsState) {
    setSettings(next);
    setStatus("Salvando...");
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setStatus(response.ok ? "Ajustes salvos." : "Nao foi possivel salvar.");
  }

  const rows: Array<{ key: keyof SettingsState; title: string; body: string }> = [
    { key: "resumePlayback", title: "Retomar episodios", body: "Continuar de onde voce parou." },
    { key: "autoplay", title: "Reproducao automatica", body: "Preparar o proximo episodio quando disponivel." },
    { key: "publicProfile", title: "Perfil publico", body: "Permitir que outros usuarios vejam seu perfil." },
    { key: "showHistory", title: "Mostrar historico", body: "Exibir atividade quando o perfil estiver publico." },
    { key: "notifyEpisodes", title: "Avisos de episodios", body: "Receber notificacoes internas de novidades." },
    { key: "reducedMotion", title: "Reducao de movimento", body: "Usar transicoes mais discretas." },
  ];

  return (
    <div className="settings-list">
      {rows.map((row) => (
        <label className="settings-row" key={row.key}>
          <span>
            <strong>{row.title}</strong>
            <small>{row.body}</small>
          </span>
          <input
            type="checkbox"
            checked={Boolean(settings[row.key])}
            onChange={(event) => update({ ...settings, [row.key]: event.target.checked })}
          />
        </label>
      ))}
      {status ? <p className="form-status">{status}</p> : null}
    </div>
  );
}
