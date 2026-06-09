export type BanState = {
  banned?: boolean | null;
  banReason?: string | null;
  bannedAt?: Date | string | null;
  bannedUntil?: Date | string | null;
};

export function isBanActive(user: BanState | null | undefined) {
  if (!user?.banned) return false;
  if (!user.bannedUntil) return true;

  const until = new Date(user.bannedUntil).getTime();
  if (!Number.isFinite(until)) return true;
  return until > Date.now();
}

export function banStatusLabel(user: BanState | null | undefined) {
  if (!isBanActive(user)) return "Ativo";
  if (!user?.bannedUntil) return "Banido";
  return `Suspenso até ${new Date(user.bannedUntil).toLocaleString("pt-BR")}`;
}

