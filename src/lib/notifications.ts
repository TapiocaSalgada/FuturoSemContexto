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

  await prisma.notification.createMany({
    data: uniqueUserIds.map((userId) => ({
      userId,
      actorId: input.actorId || null,
      type: input.type,
      title: input.title,
      body: input.body || null,
      link: input.link || null,
    })),
  });

  void sendPushToUsers(uniqueUserIds, {
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
