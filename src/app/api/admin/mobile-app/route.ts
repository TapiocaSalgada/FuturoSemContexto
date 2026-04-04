import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

const DEFAULT_BUILD_PAGE_URL =
  "https://expo.dev/accounts/tapiocasalgadas-organization/projects/futuro-sem-contexto-mobile/builds/540149d2-a989-4d0a-b7fc-f5db7521d5c1";
const DEFAULT_APK_DOWNLOAD_URL =
  "https://expo.dev/artifacts/eas/bnDMe6q2P74awQ8LYLxH9n.apk";

export async function GET() {
  const session = await getServerSession(authOptions);
  // @ts-expect-error nextauth custom role
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const downloadUrl = process.env.MOBILE_APP_ANDROID_DOWNLOAD_URL?.trim() || DEFAULT_APK_DOWNLOAD_URL;
  const buildPageUrl = process.env.MOBILE_APP_BUILD_PAGE_URL?.trim() || DEFAULT_BUILD_PAGE_URL;

  return NextResponse.json({
    downloadUrl,
    buildPageUrl,
    hasDirectDownload: Boolean(downloadUrl),
  });
}
