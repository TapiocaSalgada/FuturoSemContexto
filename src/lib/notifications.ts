import prisma from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/expo-push";

export type NotificationType =
  | "announcement"
  | "follow"
  | "comment_reply"
  | "new_episode";

type NotificationInput = {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
};

export async function createNotification(input: NotificationInput) {
  const recentDuplicate = await prisma.notification.findFirst({
    where: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      link: input.link || null,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
  });
  if (recentDuplicate) return recentDuplicate;

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      actorId: input.actorId || null,
      type: input.type,
      title: input.title,
      body: input.body || null,
      link: input.link || null,
    },
  });

  void sendPushToUsers([input.userId], {
    title: input.title,
    body: input.body || null,
    link: input.link || null,
    data: {
      notificationId: notification.id,
      type: input.type,
    },
  }).catch(() => {
    // ignore push failures
  });

  return notification;
}

export async function createNotificationsForUsers(
  userIds: string[],
  input: Omit<NotificationInput, "userId">,
) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) return;

  const existing = await prisma.notification.findMany({
    where: {
      userId: { in: uniqueUserIds },
      type: input.type,
      title: input.title,
      link: input.link || null,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { userId: true },
  });
  const existingUsers = new Set(existing.map((item) => item.userId));
  const targetUsers = uniqueUserIds.filter((userId) => !existingUsers.has(userId));
  if (targetUsers.length === 0) return;

  await prisma.notification.createMany({
    data: targetUsers.map((userId) => ({
      userId,
      actorId: input.actorId || null,
      type: input.type,
      title: input.title,
      body: input.body || null,
      link: input.link || null,
    })),
  });

  void sendPushToUsers(targetUsers, {
    title: input.title,
    body: input.body || null,
    link: input.link || null,
    data: {
      type: input.type,
    },
  }).catch(() => {
    // ignore push failures
  });
}
