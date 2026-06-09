import { redirect } from "next/navigation";
import { User } from "lucide-react";

import AppShell from "@/components/AppShell";
import ProfileForm from "@/components/profile/ProfileForm";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function EditarPerfilPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell>
      <main className="stack-page">
        <section className="compact-hero">
          <p className="eyebrow"><User aria-hidden size={16} /> Perfil</p>
          <h1>Editar perfil.</h1>
          <p>Atualize nome, username, avatar, banner e privacidade.</p>
        </section>
        <section className="form-panel">
          <ProfileForm user={{ id: user.id, name: user.name, username: user.username, bio: user.bio, avatarUrl: user.avatarUrl, bannerUrl: user.bannerUrl, isPrivate: user.isPrivate }} />
        </section>
      </main>
    </AppShell>
  );
}
