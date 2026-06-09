"use client";

import { FormEvent, useState } from "react";

type ProfileInput = {
  id: string;
  name: string;
  username?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  isPrivate?: boolean;
};

export default function ProfileForm({ user }: { user: ProfileInput }) {
  const [name, setName] = useState(user.name || "");
  const [username, setUsername] = useState(user.username || "");
  const [bio, setBio] = useState(user.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
  const [bannerUrl, setBannerUrl] = useState(user.bannerUrl || "");
  const [isPrivate, setIsPrivate] = useState(Boolean(user.isPrivate));
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Salvando...");
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, bio, avatarUrl, bannerUrl, isPrivate }),
    });
    setStatus(response.ok ? "Perfil atualizado." : "Nao foi possivel atualizar.");
  }

  return (
    <form className="settings-form" onSubmit={submit}>
      <label>
        Nome
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label>
        Username
        <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="seu-nome" />
      </label>
      <label>
        Bio
        <textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={4} />
      </label>
      <label>
        Avatar URL
        <input value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} />
      </label>
      <label>
        Banner URL
        <input value={bannerUrl} onChange={(event) => setBannerUrl(event.target.value)} />
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)} />
        Perfil privado
      </label>
      <button className="primary-action" type="submit">
        Salvar perfil
      </button>
      {status ? <p className="form-status">{status}</p> : null}
    </form>
  );
}
