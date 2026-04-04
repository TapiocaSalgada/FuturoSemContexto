export const ONLINE_WINDOW_MS = 3 * 60 * 1000;

export function isUserOnline(lastActiveAt: Date | string | null | undefined): boolean {
  if (!lastActiveAt) return false;
  const lastActiveMs = new Date(lastActiveAt).getTime();
  if (Number.isNaN(lastActiveMs)) return false;
  return Date.now() - lastActiveMs <= ONLINE_WINDOW_MS;
}
