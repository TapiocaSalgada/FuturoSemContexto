"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

export default function WatchPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch anime / episode plus history
    fetch(`/api/watch/${params.id}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
        if (d.history?.progressSec && videoRef.current) {
          videoRef.current.currentTime = d.history.progressSec;
        }
      });
  }, [params.id]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !data?.episodeId || !session?.user) return;

    const interval = setInterval(() => {
      if (!v.paused) {
        fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ episodeId: data.episodeId, progressSec: Math.floor(v.currentTime) })
        });
      }
    }, 10000); // Save every 10 seconds

    return () => clearInterval(interval);
  }, [data, session]);

  if (loading) return <div className="min-h-screen bg-black flex justify-center items-center text-pink-500">Carregando...</div>;
  if (!data) return <div className="min-h-screen bg-black flex justify-center items-center text-white">Vídeo não encontrado.</div>;

  const isGoogleDrive = data?.videoToPlay?.includes("drive.google.com");
  let driveEmbedUrl = data?.videoToPlay;
  if (isGoogleDrive) {
    const match = data.videoToPlay.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      driveEmbedUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative">
      <Link href={`/anime/${data.anime.id}`} className="absolute top-8 left-8 p-3 bg-zinc-900/80 hover:bg-pink-600 rounded-full text-white transition z-50 group shadow-lg">
        <ArrowLeft size={24} className="group-hover:-translate-x-1 transition" />
      </Link>

      <div className="w-full max-w-7xl aspect-video bg-zinc-900 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-zinc-800 relative z-10 group">
        {isGoogleDrive ? (
          <iframe
            src={driveEmbedUrl}
            className="w-full h-full outline-none"
            allow="autoplay; fullscreen"
            allowFullScreen
          ></iframe>
        ) : (
          <video 
            ref={videoRef}
            controls 
            autoPlay 
            className="w-full h-full outline-none"
            poster={data.anime.bannerImage || data.anime.coverImage || ""}
          >
            <source src={data.videoToPlay} type="video/mp4" />
            Seu navegador não suporta este formato de vídeo ou requer codec MP4.
          </video>
        )}
      </div>

      <div className="w-full max-w-7xl mt-8 px-4">
        <p className="text-pink-500 font-bold mb-1">{data.epTitle || "Assistindo Obra Completa"}</p>
        <h1 className="text-3xl font-black text-white">{data.anime.title}</h1>
      </div>
    </div>
  );
}
