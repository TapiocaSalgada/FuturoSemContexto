import prisma from "@/lib/prisma";

export const MAINTENANCE_ANNOUNCEMENT_TITLE = "__system:maintenance__";
export const DEFAULT_MAINTENANCE_MESSAGE = "Estamos em manutencao. Voltamos em breve.";

type MaintenancePayload = {
  enabled?: boolean;
  message?: string;
  updatedAt?: string;
};

function parsePayload(content?: string | null): MaintenancePayload {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function isSystemAnnouncementTitle(title?: string | null) {
  return Boolean(title?.startsWith("__system:"));
}

export async function getMaintenanceState() {
  const row = await prisma.announcement.findFirst({
    where: { title: MAINTENANCE_ANNOUNCEMENT_TITLE },
    orderBy: { createdAt: "desc" },
    select: { id: true, content: true, createdAt: true },
  });

  if (!row) {
    return {
      enabled: false,
      message: DEFAULT_MAINTENANCE_MESSAGE,
      updatedAt: null as string | null,
    };
  }

  const payload = parsePayload(row.content);
  return {
    enabled: Boolean(payload.enabled),
    message: payload.message?.trim() || DEFAULT_MAINTENANCE_MESSAGE,
    updatedAt: payload.updatedAt || row.createdAt.toISOString(),
  };
}

export async function setMaintenanceState(enabled: boolean, message?: string) {
  const normalizedMessage = message?.trim() || DEFAULT_MAINTENANCE_MESSAGE;
  const content = JSON.stringify({
    enabled,
    message: normalizedMessage,
    updatedAt: new Date().toISOString(),
  });

  const row = await prisma.announcement.findFirst({
    where: { title: MAINTENANCE_ANNOUNCEMENT_TITLE },
    select: { id: true },
  });

  if (!row) {
    await prisma.announcement.create({
      data: {
        title: MAINTENANCE_ANNOUNCEMENT_TITLE,
        content,
      },
    });
  } else {
    await prisma.announcement.update({
      where: { id: row.id },
      data: { content },
    });
  }

  return getMaintenanceState();
}
