import "server-only";

import { headers } from "next/headers";

import prisma from "@/lib/prisma";
import type { AdminActor } from "@/lib/admin/permissions";

type AuditInput = {
  actor: AdminActor;
  action: string;
  entityType: string;
  entityId?: string | null;
  contentId?: string | null;
  before?: unknown;
  after?: unknown;
};

export async function writeAdminAuditLog(input: AuditInput) {
  try {
    const headerStore = headers();
    const userAgent = headerStore.get("user-agent") || undefined;
    const forwarded = headerStore.get("x-forwarded-for") || "";
    const ipMasked = forwarded ?`${forwarded.split(".").slice(0, 2).join(".")}.*.*` : undefined;

    await prisma.adminAuditLog.create({
      data: {
        adminId: input.actor.id,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId || null,
        contentId: input.contentId || null,
        before: input.before === undefined ?undefined : (input.before as any),
        after: {
          value: input.after ?? null,
          userAgent,
          ipMasked,
        } as any,
      },
    });
  } catch (error) {
    console.error("admin_audit_failed", error);
  }
}
