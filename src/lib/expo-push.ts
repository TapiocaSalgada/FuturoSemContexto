import prisma from "@/lib/prisma";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const MAX_MESSAGES_PER_BATCH = 100;

type PushPayload = {
  title: string;
  body?: string | null;
  link?: string | null;
  data?: Record<string, unknown>;
};

type PushTokenRow = {
  id: string;
  token: string;
};

function isExpoPushToken(token: string) {
  return /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(token);
}

function chunk<T>(list: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
}

async function markInactiveByTokens(tokens: string[]) {
  if (!tokens.length) return;

  await prisma.mobilePushToken.updateMany({
    where: { token: { in: tokens } },
    data: { isActive: false },
  });
}

async function sendBatch(tokens: PushTokenRow[], payload: PushPayload) {
  if (!tokens.length) return;

  const tokenMap = new Map(tokens.map((item) => [item.token, item.id]));
  const messages = tokens.map((item) => ({
    to: item.token,
    title: payload.title,
    body: payload.body || undefined,
    data: {
      ...(payload.data || {}),
      link: payload.link || undefined,
    },
    sound: "default",
    channelId: "default",
    priority: "high",
  }));

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }

  const response = await fetch(EXPO_PUSH_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    return;
  }

  const json = await response.json().catch(() => null);
  const data = Array.isArray(json?.data) ? json.data : [];
  const invalidTokens: string[] = [];

  for (let index = 0; index < data.length; index += 1) {
    const item = data[index];
    if (item?.status === "ok") continue;

    const detailsError = String(item?.details?.error || "");
    const mappedToken = messages[index]?.to;
    if (!mappedToken) continue;

    if (detailsError === "DeviceNotRegistered" || detailsError === "InvalidCredentials") {
      invalidTokens.push(mappedToken);
    }
  }

  if (invalidTokens.length) {
    await markInactiveByTokens(invalidTokens);
  }

  const touchedIds = messages
    .map((message) => tokenMap.get(String(message.to)))
    .filter((id): id is string => Boolean(id));

  if (touchedIds.length) {
    await prisma.mobilePushToken.updateMany({
      where: { id: { in: touchedIds } },
      data: { lastUsedAt: new Date() },
    });
  }
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (!uniqueUserIds.length) return;

  const tokens = await prisma.mobilePushToken.findMany({
    where: {
      userId: { in: uniqueUserIds },
      isActive: true,
    },
    select: {
      id: true,
      token: true,
    },
  });

  const validTokens = tokens.filter((item) => isExpoPushToken(item.token));
  const invalidSavedTokens = tokens
    .filter((item) => !isExpoPushToken(item.token))
    .map((item) => item.token);

  if (invalidSavedTokens.length) {
    await markInactiveByTokens(invalidSavedTokens);
  }

  if (!validTokens.length) return;

  const batches = chunk(validTokens, MAX_MESSAGES_PER_BATCH);
  for (const batch of batches) {
    await sendBatch(batch, payload);
  }
}
