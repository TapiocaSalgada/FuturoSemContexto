import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import { Heart } from "lucide-react";

export default function AboutPage() {
  return (
    <AppLayout>
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Heart size={48} className="text-pink-500/30 fill-pink-500/30 mx-auto" />
          <p className="text-zinc-600 font-bold">Futuro sem Contexto</p>
        </div>
      </div>
    </AppLayout>
  );
}
