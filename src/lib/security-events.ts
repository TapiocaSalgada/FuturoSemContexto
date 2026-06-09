import "server-only";

import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";

export function maskIp(ip: string | null | undefined) {
  const value = String(ip || "").trim();
  if (!value || value === "unknown") return null;
  if (value.includes(":")) return value.split(":").slice(0, 3).join(":") + ":***";
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
}

export function describeDevice(userAgent: string | null | undefined) {
  const ua = String(userAgent || "");
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Navegador";
  const device = /Mobile|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop";
  return `${browser} (${device})`;
}

export function sessionHash(userId: string, userAgent: string, ip: string) {
  return createHash("sha256")
    .update(`${userId}:${userAgent}:${ip}:${process.env.NEXTAUTH_SECRET || ""}`)
    .digest("hex");
}

export async function recordSecurityEvent(userId: string, type: string, metadata?: Record<string, unknown>) {
  try {
    await prisma.securityEvent.create({
      data: {
        userId,
        type,
        metadata: metadata ?(metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  } catch (error) {
    console.warn("[security-event] failed", type, error);
  }
}

export async function touchAccountSession({
  userId,
  userAgent,
  ip,
}: {
  userId: string;
  userAgent: string;
  ip: string;
}) {
  const sessionIdHash = sessionHash(userId, userAgent, ip);

  try {
    await prisma.accountSession.upsert({
      where: { sessionIdHash },
      update: {
        lastSeenAt: new Date(),
        revokedAt: null,
      },
      create: {
        userId,
        sessionIdHash,
        userAgent: userAgent.slice(0, 500),
        deviceLabel: describeDevice(userAgent),
        ipMasked: maskIp(ip),
      },
    });
  } catch (error) {
    console.warn("[account-session] failed", error);
  }
}
