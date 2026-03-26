import prisma from "@/lib/prisma";

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
  return prisma.notification.create({
    data: {
      userId: input.userId,
      actorId: input.actorId || null,
      type: input.type,
      title: input.title,
      body: input.body || null,
      link: input.link || null,
    },
  });
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
}
