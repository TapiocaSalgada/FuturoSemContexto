export type SavedAccount = {
  email: string;
  name: string;
  avatar?: string;
  handoffHash?: string;
  role?: string;
};

const STORAGE_KEY = "savedAccounts";

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeSavedAccount(value: unknown): SavedAccount | null {
  if (!value || typeof value !== "object") return null;

  const input = value as Record<string, unknown>;
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) return null;

  const name = normalizeText(input.name) || email;
  const avatar = normalizeText(input.avatar);
  const handoffHash = normalizeText(input.handoffHash);
  const role = normalizeText(input.role);

  return {
    email,
    name,
    ...(avatar ? { avatar } : {}),
    ...(handoffHash ? { handoffHash } : {}),
    ...(role ? { role } : {}),
  };
}

function sanitizeList(list: unknown, max = 8): SavedAccount[] {
  const raw = Array.isArray(list) ? list : [];
  const seen = new Set<string>();
  const output: SavedAccount[] = [];

  for (const item of raw) {
    const account = normalizeSavedAccount(item);
    if (!account || seen.has(account.email)) continue;
    seen.add(account.email);
    output.push(account);
    if (output.length >= max) break;
  }

  return output;
}

export function readSavedAccounts(max = 8): SavedAccount[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return sanitizeList(parsed, max);
  } catch {
    return [];
  }
}

export function writeSavedAccounts(list: SavedAccount[], max = 8): SavedAccount[] {
  if (typeof window === "undefined") return [];

  const sanitized = sanitizeList(list, max);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // ignore storage quota / private mode issues
  }

  return sanitized;
}

export function upsertSavedAccount(account: SavedAccount, max = 8): SavedAccount[] {
  const normalized = normalizeSavedAccount(account);
  if (!normalized) return readSavedAccounts(max);

  const current = readSavedAccounts(max);
  const next = [
    normalized,
    ...current.filter((item) => item.email !== normalized.email),
  ];

  return writeSavedAccounts(next, max);
}

export function removeSavedAccount(email: string, max = 8): SavedAccount[] {
  const normalizedEmail = normalizeEmail(email);
  const current = readSavedAccounts(max);
  return writeSavedAccounts(
    current.filter((item) => item.email !== normalizedEmail),
    max,
  );
}
