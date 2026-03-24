import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const videosDir = path.join(process.cwd(), "public", "videos");
    
    if (!fs.existsSync(videosDir)) {
      fs.mkdirSync(videosDir, { recursive: true });
    }

    const files = fs.readdirSync(videosDir);
    const videoFiles = files.filter(f => f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.webm'));

    return NextResponse.json({ files: videoFiles });
  } catch (error) {
    console.error("Local files error:", error);
    return new NextResponse("Error reading local directory", { status: 500 });
  }
}
