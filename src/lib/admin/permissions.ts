import "server-only";

import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { isOwnerEmail, isSiteAdmin } from "@/lib/admin-access";
import prisma from "@/lib/prisma";

export type AdminRole = "user" | "moderator" | "admin" | "owner";

export type AdminActor = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  isOwner: boolean;
};

function normalizeRole(role: string | null | undefined): AdminRole {
  const value = String(role || "user").toLowerCase();
  if (value === "owner" || value === "admin" || value === "moderator") return value;
  return "user";
}

export async function getAdminActor(): Promise<AdminActor | null> {
  const session = await getServerSession(authOptions);
  if (!isSiteAdmin(session as any)) return null;

  const email = String(session?.user?.email || "").trim().toLowerCase();
  if (!email) return null;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) return null;
  const isOwner = isOwnerEmail(user.email);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: isOwner ? "owner" : normalizeRole(user.role),
    isOwner,
  };
}

export async function requireAdminActor() {
  const actor = await getAdminActor();
  if (!actor) throw new Error("ADMIN_REQUIRED");
  return actor;
}

export async function requireAdminPage() {
  const actor = await getAdminActor();
  if (!actor) redirect("/");
  return actor;
}

export function canManageRoles(actor: AdminActor, target?: { id?: string; email?: string | null; role?: string | null }) {
  if (actor.isOwner) return true;
  if (target?.email && isOwnerEmail(target.email)) return false;
  if (String(target?.role || "").toLowerCase() === "admin") return false;
  return actor.role === "admin";
}

export function canUseDestructiveAdminAction(actor: AdminActor) {
  return actor.role === "admin" || actor.role === "owner";
}
