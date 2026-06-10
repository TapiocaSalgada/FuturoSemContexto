"use client";

import { useState } from "react";
import { Bug, X, Send } from "lucide-react";
import { usePathname } from "next/navigation";

export default function BugReportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const pathname = usePathname();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      type: formData.get("type") as string,
      pagePath: pathname,
    };

    try {
      const res = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(false);
        }, 2000);
      } else {
        alert("Erro ao enviar bug. Tente novamente mais tarde.");
      }
    } catch (err) {
      alert("Erro ao enviar bug.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        className="bug-fab" 
        onClick={() => setIsOpen(true)}
        aria-label="Reportar um problema"
        title="Encontrou um erro?"
      >
        <Bug size={24} />
      </button>

      {isOpen && (
        <div className="bug-modal-overlay">
          <div className="bug-modal">
            <h2>Reportar um Problema</h2>
            {success ? (
              <p style={{ color: "var(--green)", marginTop: "16px", fontWeight: "bold" }}>
                Relatório enviado com sucesso! Obrigado por ajudar a melhorar o Futuro Stream.
              </p>
            ) : (
              <form onSubmit={handleSubmit}>
                <label htmlFor="bug-type">Onde ocorreu o problema?</label>
                <select id="bug-type" name="type" required>
                  <option value="site_bug">Erro no Site / Interface</option>
                  <option value="player_error">Erro no Player de Vídeo</option>
                  <option value="content_error">Erro no Conteúdo (Episódio errado, legenda, etc)</option>
                </select>

                <label htmlFor="bug-title">Resumo do problema</label>
                <input 
                  id="bug-title" 
                  name="title" 
                  type="text" 
                  placeholder="Ex: O player não carrega no episódio 5" 
                  required 
                  maxLength={100}
                />

                <label htmlFor="bug-desc">Detalhes adicionais</label>
                <textarea 
                  id="bug-desc" 
                  name="description" 
                  placeholder="Explique o que aconteceu, qual navegador está usando, etc." 
                  required 
                  maxLength={1000}
                />

                <div className="bug-modal-actions">
                  <button type="button" className="cancel" onClick={() => setIsOpen(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="submit" disabled={loading}>
                    {loading ? "Enviando..." : (
                      <>
                        Enviar Relatório <Send size={16} style={{ display: 'inline', marginLeft: 4, verticalAlign: 'text-bottom' }}/>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
