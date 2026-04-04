import { PrismaClient } from "@prisma/client";

function encodeDbCredential(value: string) {
  try {
    return encodeURIComponent(decodeURIComponent(value));
  } catch {
    return encodeURIComponent(value);
  }
}

function normalizeDatabaseUrl(rawUrl: string) {
  const value = String(rawUrl || "").trim();
  if (!value) return value;

  const schemeIndex = value.indexOf("://");
  if (schemeIndex < 0) return value;

  const authorityStart = schemeIndex + 3;
  const pathIndex = value.indexOf("/", authorityStart);
  const authorityEnd = pathIndex >= 0 ? pathIndex : value.length;
  const authority = value.slice(authorityStart, authorityEnd);
  const atIndex = authority.lastIndexOf("@");
  if (atIndex < 0) return value;

  const userInfo = authority.slice(0, atIndex);
  const hostInfo = authority.slice(atIndex + 1);
  const colonIndex = userInfo.indexOf(":");
  if (colonIndex < 0) return value;

  const username = userInfo.slice(0, colonIndex);
  const password = userInfo.slice(colonIndex + 1);
  const safeUserInfo = `${encodeDbCredential(username)}:${encodeDbCredential(password)}`;

  return `${value.slice(0, authorityStart)}${safeUserInfo}@${hostInfo}${value.slice(authorityEnd)}`;
}

function withConnectionParams(url: string) {
  const normalized = normalizeDatabaseUrl(url);

  try {
    const parsed = new URL(normalized);

    if (
      parsed.hostname.endsWith(".pooler.supabase.com") &&
      (!parsed.port || parsed.port === "5432")
    ) {
      parsed.port = "6543";
    }

    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "1");
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "20");
    }
    if (!parsed.searchParams.has("pgbouncer")) {
      parsed.searchParams.set("pgbouncer", "true");
    }
    return parsed.toString();
  } catch {
    let next = normalized;
    const hasQuery = next.includes("?");
    if (!/([?&])connection_limit=/i.test(next)) {
      next += `${hasQuery ? "&" : "?"}connection_limit=1`;
    }
    if (!/([?&])pool_timeout=/i.test(next)) {
      next += `${next.includes("?") ? "&" : "?"}pool_timeout=20`;
    }
    if (!/([?&])pgbouncer=/i.test(next)) {
      next += `${next.includes("?") ? "&" : "?"}pgbouncer=true`;
    }
    return next;
  }
}

const datasourceUrl = process.env.DATABASE_URL
  ? withConnectionParams(process.env.DATABASE_URL)
  : undefined;

const prismaClientSingleton = () =>
  new PrismaClient({
    ...(datasourceUrl
      ? {
          datasources: {
            db: { url: datasourceUrl },
          },
        }
      : {}),
  });

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (!globalThis.prismaGlobal) {
  globalThis.prismaGlobal = prisma;
}
