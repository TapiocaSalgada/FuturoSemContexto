"use client";

import { create } from "zustand";

import { normalizeTheme } from "@/lib/theme";

type ThemeState = {
  theme: string;
  setTheme: (theme: string) => void;
};

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "kandaraku-dark",
  setTheme: (theme) => {
    const next = normalizeTheme(theme);
    localStorage.setItem("app-theme", next);
    set({ theme: next });
  },
}));

// Hidrata estado inicial a partir do localStorage em ambiente client
if (typeof window !== "undefined") {
  try {
    const storedTheme = normalizeTheme(localStorage.getItem("app-theme"));
    useThemeStore.setState({
      theme: storedTheme,
    });
  } catch (e) {
    // ignore
  }
}
