import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface FileEntry {
  name: string;   // display name
  path: string;   // relative to /videos/, used as URL: /videos/path
  folder: string; // subfolder name or "" for root
}

function scanDir(dir: string, base: string = ""): FileEntry[] {
  const entries: FileEntry[] = [];
  if (!fs.existsSync(dir)) return entries;

  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      // recurse one level deep
      const subEntries = scanDir(full, item);
      entries.push(...subEntries);
    } else if (/\.(mp4|mkv|webm|avi|mov)$/i.test(item)) {
      const filePath = base ? `${base}/${item}` : item;
      entries.push({ name: item, path: filePath, folder: base });
    }
  }
  return entries;
}

export async function GET() {
  try {
    const videosDir = path.join(process.cwd(), "public", "videos");
    if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });

    const entries = scanDir(videosDir);

    // unique folder names
    const folders = [...new Set(entries.map(e => e.folder).filter(Boolean))];

    return NextResponse.json({ files: entries, folders });
  } catch (error) {
    console.error("Local files error:", error);
    return new NextResponse("Error reading local directory", { status: 500 });
  }
}
