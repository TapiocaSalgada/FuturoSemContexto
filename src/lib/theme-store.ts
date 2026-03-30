"use client";

import { create } from "zustand";

type ThemeState = {
  theme: string;
  setTheme: (theme: string) => void;
};

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "pink",
  setTheme: (theme) => {
    localStorage.setItem("app-theme", theme);
    set({ theme });
  },
}));

// Hidrata estado inicial a partir do localStorage em ambiente client
if (typeof window !== "undefined") {
  try {
    const storedTheme = localStorage.getItem("app-theme") || "pink";
    useThemeStore.setState({
      theme: storedTheme,
    });
  } catch (e) {
    // ignore
  }
}
