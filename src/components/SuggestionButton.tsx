"use client";

import { useState } from "react";
import { Lightbulb, X, Send } from "lucide-react";

export default function SuggestionButton() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) {
      setSent(true);
      setTimeout(() => { setSent(false); setOpen(false); setForm({ title: "", description: "" }); }, 2000);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold px-5 py-3 rounded-full shadow-[0_0_25px_rgba(255,0,127,0.3)] hover:shadow-[0_0_35px_rgba(255,0,127,0.5)] transition text-sm"
        title="Sugerir Anime"
      >
        <Lightbulb size={16} />
        <span className="hidden sm:block">Sugerir Anime</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-[#1a1a1a] border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-xl flex items-center gap-2">
                <Lightbulb size={20} className="text-pink-500" /> Sugerir Anime
              </h2>
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white transition">
                <X size={20} />
              </button>
            </div>
            <p className="text-zinc-400 text-sm">Já vai direto pro painel do admin revisar!</p>

            {sent ? (
              <div className="py-8 text-center">
                <div className="text-4xl mb-3">🎉</div>
                <p className="font-bold text-green-400">Sugestão enviada! Obrigado!</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-zinc-400 mb-1 block">Nome do Anime *</label>
                  <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-pink-500 transition"
                    placeholder="Ex: One Piece" />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-400 mb-1 block">Detalhes / Motivo (opcional)</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-pink-500 transition min-h-[80px] resize-none"
                    placeholder="Por que você quer ver esse anime aqui?" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-500 text-white font-bold py-2.5 rounded-lg transition disabled:opacity-50">
                  <Send size={16} /> {loading ? "Enviando..." : "Enviar Sugestão"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
