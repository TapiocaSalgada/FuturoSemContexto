import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Never cache — always read from disk fresh
export const dynamic = "force-dynamic";

interface FileEntry {
  name: string;   // display name
  path: string;   // relative to /videos/
  folder: string; // subfolder name or "" for root
}

function scanDir(dir: string, base: string = ""): FileEntry[] {
  const entries: FileEntry[] = [];
  if (!fs.existsSync(dir)) return entries;

  let items: string[];
  try {
    items = fs.readdirSync(dir);
  } catch {
    return entries;
  }

  for (const item of items) {
    // skip hidden files/system files
    if (item.startsWith(".")) continue;
    const full = path.join(dir, item);
    let stat: fs.Stats;
    try { stat = fs.statSync(full); } catch { continue; }

    if (stat.isDirectory()) {
      // recurse deeply
      const newBase = base ? `${base}/${item}` : item;
      const subEntries = scanDir(full, newBase);
      entries.push(...subEntries);
    } else if (/\.(mp4|mkv|webm|avi|mov|m4v)$/i.test(item)) {
      const filePath = base ? `${base}/${item}` : item;
      entries.push({ name: item, path: filePath, folder: base });
    }
  }
  return entries;
}

export async function GET(req: Request) {
  try {
    // On Vercel/serverless the filesystem is read-only under /var/task.
    // Short-circuit to an empty list to avoid runtime errors.
    if (process.env.VERCEL === "1") {
      return NextResponse.json({ files: [], folders: [], note: "local-files disabled on Vercel" });
    }

    const videosDir = path.join(process.cwd(), "public", "videos");

    // Create folder if it doesn't exist (only in writable environments)
    if (!fs.existsSync(videosDir)) {
      fs.mkdirSync(videosDir, { recursive: true });
    }

    const entries = scanDir(videosDir);
    const folders = Array.from(new Set(entries.map(e => e.folder).filter(Boolean)));

    const { searchParams } = new URL(req.url);
    if (searchParams.get("debug") === "1") {
      return NextResponse.json({
        videosDir,
        exists: fs.existsSync(videosDir),
        rawContents: fs.readdirSync(videosDir),
        files: entries,
        folders,
      });
    }

    return NextResponse.json({ files: entries, folders });
  } catch (error: any) {
    console.error("Local files error:", error);
    return NextResponse.json({ files: [], folders: [], error: error?.message }, { status: 200 });
  }
}
/**
 * Local file support endpoint for operational tooling.
 */
