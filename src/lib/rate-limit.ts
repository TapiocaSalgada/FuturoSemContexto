import { NextResponse } from "next/server";

type RateLimitState = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitState>();

export function getRequestIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const realIp = req.headers.get("x-real-ip") || "";
  return (forwarded.split(",")[0] || realIp || "unknown").trim();
}

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, retryAfter: 0 };
  }

  current.count += 1;
  if (current.count <= limit) {
    return { limited: false, retryAfter: 0 };
  }

  return { limited: true, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
}

export function rateLimitResponse(retryAfter: number) {
  return NextResponse.json(
    { error: "Muitas tentativas. Tente novamente em instantes." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, retryAfter)),
      },
    },
  );
}
