import { Settings } from "lucide-react";

import AppShell from "@/components/AppShell";
import SettingsClient from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default function ConfiguracoesPage() {
  return (
    <AppShell>
      <main className="stack-page settings-page">
        <section className="compact-hero">
          <p className="eyebrow"><Settings aria-hidden size={16} /> Configurações</p>
          <h1>Conta, reprodução e privacidade.</h1>
          <p>Lista simples de app, com toggles reais e sem recursos prometidos sem backend.</p>
        </section>
        <section className="form-panel">
          <SettingsClient />
        </section>
      </main>
    </AppShell>
  );
}
