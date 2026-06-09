"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

function getSafeCallback(raw: string | null) {
  const value = String(raw || "").trim();
  if (!value || value.startsWith("http") || value.startsWith("/login")) return "/";
  return value.startsWith("/") ? value : "/";
}

export default function LoginPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const callbackUrl = getSafeCallback(
    searchParams.get("callbackUrl") || searchParams.get("redirect"),
  );

  useEffect(() => {
    if (session?.user?.email) window.location.replace(callbackUrl);
  }, [callbackUrl, session?.user?.email]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier || !password) {
      setError("Informe usuario/e-mail e senha.");
      return;
    }

    setLoading(true);
    setError("");

    const response = await signIn("credentials", {
      identifier: cleanIdentifier,
      email: cleanIdentifier,
      password,
      callbackUrl,
      redirect: false,
    });

    if (response?.error) {
      setError("Credenciais invalidas ou conta indisponivel.");
      setLoading(false);
      return;
    }

    window.location.assign(callbackUrl);
  }

  return (
    <main className="fsc-page">
      <section className="fsc-shell fsc-card">
        <p className="fsc-eyebrow">Acesso preservado</p>
        <h1 className="fsc-title">Entrar</h1>
        <p className="fsc-text">
          O login foi mantido para preservar usuarios e permitir administrar a reconstrucao.
        </p>

        <form className="fsc-form" onSubmit={submit}>
          {error ? <div className="fsc-error">{error}</div> : null}

          <label className="fsc-label">
            E-mail ou usuario
            <input
              className="fsc-input"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label className="fsc-label">
            Senha
            <input
              className="fsc-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <button className="fsc-button" type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="fsc-actions">
          <Link className="fsc-button secondary" href="/">Voltar</Link>
        </div>
      </section>
    </main>
  );
}
