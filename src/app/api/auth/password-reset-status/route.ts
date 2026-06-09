import { NextResponse } from "next/server";

import { isPasswordResetEnabled } from "@/lib/server-features";

export async function GET() {
  return NextResponse.json(
    {
      enabled:
        process.env.NEXT_PUBLIC_ENABLE_PASSWORD_RESET === "true" &&
        isPasswordResetEnabled(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
