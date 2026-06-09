"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export default function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Criando conta...");
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      setStatus("Nao foi possivel criar a conta.");
      return;
    }

    await signIn("credentials", {
      identifier: email,
      email,
      password,
      callbackUrl: "/",
      redirect: true,
    });
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Futuro sem Contexto</p>
        <h1>Criar conta</h1>
        <p>Entre no catalogo gratuito e mantenha sua lista e progresso sincronizados.</p>
        <form className="settings-form" onSubmit={submit}>
          <label>
            Nome
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
          </label>
          <label>
            E-mail
            <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" type="email" required />
          </label>
          <label>
            Senha
            <input value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" type="password" minLength={6} required />
          </label>
          <button className="primary-action" type="submit">
            Criar conta
          </button>
        </form>
        {status ? <p className="form-status">{status}</p> : null}
        <Link className="text-link" href="/login">
          Ja tenho conta
        </Link>
      </section>
    </main>
  );
}
