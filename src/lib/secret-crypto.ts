import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function encryptionKey() {
  const material = process.env.TWO_FACTOR_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!material) throw new Error("NEXTAUTH_SECRET is required for secret encryption");
  return createHash("sha256").update(material).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string) {
  const [version, ivRaw, tagRaw, encryptedRaw] = String(payload || "").split(":");
  if (version !== "v1" || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Invalid encrypted secret");
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
