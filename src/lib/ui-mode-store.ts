"use client";

import { create } from "zustand";

const ULTRA_SIMPLE_MODE_STORAGE_KEY = "futuro-ultra-simple-mode";

function normalizeUltraSimpleMode(value: unknown) {
  if (typeof value === "boolean") return value;
  const text = String(value || "").trim().toLowerCase();
  return text === "1" || text === "true" || text === "on";
}

type UiModeState = {
  ultraSimpleMode: boolean;
  setUltraSimpleMode: (enabled: boolean) => void;
  toggleUltraSimpleMode: () => void;
};

export const useUiModeStore = create<UiModeState>((set, get) => ({
  ultraSimpleMode: false,
  setUltraSimpleMode: (enabled) => {
    const next = Boolean(enabled);
    try {
      localStorage.setItem(ULTRA_SIMPLE_MODE_STORAGE_KEY, next ?"1" : "0");
    } catch {
      // ignore private mode / storage quota errors
    }
    set({ ultraSimpleMode: next });
  },
  toggleUltraSimpleMode: () => {
    const current = get().ultraSimpleMode;
    const next = !current;
    try {
      localStorage.setItem(ULTRA_SIMPLE_MODE_STORAGE_KEY, next ?"1" : "0");
    } catch {
      // ignore private mode / storage quota errors
    }
    set({ ultraSimpleMode: next });
  },
}));

if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem(ULTRA_SIMPLE_MODE_STORAGE_KEY);
    useUiModeStore.setState({
      ultraSimpleMode: normalizeUltraSimpleMode(stored),
    });
  } catch {
    // ignore access issues
  }
}

