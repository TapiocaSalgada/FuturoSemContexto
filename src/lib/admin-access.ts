const DEFAULT_OWNER_EMAIL = "relugocruz@gmail.com";

const ownerEmail = String(process.env.OWNER_EMAIL || DEFAULT_OWNER_EMAIL)
  .trim()
  .toLowerCase();

type SessionLike = {
  user?: {
    email?: string | null;
    role?: string | null;
  } | null;
} | null | undefined;

export function isOwnerEmail(email: string | null | undefined) {
  return String(email || "").trim().toLowerCase() === ownerEmail;
}

export function isSiteAdmin(session: SessionLike) {
  const role = String(session?.user?.role || "").trim().toLowerCase();
  if (role === "admin") return true;
  return isOwnerEmail(session?.user?.email);
}

