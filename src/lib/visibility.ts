export type ContentVisibility = "public" | "admin_only";

export function normalizeVisibility(value: unknown): ContentVisibility {
  return String(value || "").trim().toLowerCase() === "public"
    ? "public"
    : "admin_only";
}

export function isPublicVisibility(value: unknown): boolean {
  return normalizeVisibility(value) === "public";
}
