"use client";

import { useEffect, useState } from "react";

type ToastMessage = {
  id: string;
  text: string;
  type: "success" | "error" | "info";
};

const listeners: Array<(toast: ToastMessage) => void> = [];

export function showToast(text: string, type: "success" | "error" | "info" = "info") {
  const toast: ToastMessage = { id: `${Date.now()}-${Math.random()}`, text, type };
  listeners.forEach((fn) => fn(toast));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (toast: ToastMessage) => {
      setToasts((prev) => [...prev.slice(-4), toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 4000);
    };
    listeners.push(handler);
    return () => {
      const idx = listeners.indexOf(handler);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          {toast.text}
        </div>
      ))}
    </div>
  );
}
