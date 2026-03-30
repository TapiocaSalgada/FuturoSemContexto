"use client";

import { create } from "zustand";

type ThemeState = {
  theme: string;
  wallpaperUrl: string;
  wallpaperEnabled: boolean;
  setTheme: (theme: string) => void;
  setWallpaperUrl: (url: string) => void;
  setWallpaperEnabled: (enabled: boolean) => void;
};

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "pink",
  wallpaperUrl: "",
  wallpaperEnabled: true,
  setTheme: (theme) => {
    localStorage.setItem("app-theme", theme);
    set({ theme });
  },
  setWallpaperUrl: (url) => {
    localStorage.setItem("app-wallpaper-url", url);
    set({ wallpaperUrl: url });
  },
  setWallpaperEnabled: (enabled) => {
    localStorage.setItem("app-wallpaper-enabled", String(enabled));
    set({ wallpaperEnabled: enabled });
  },
}));

// Hidrata estado inicial a partir do localStorage em ambiente client
if (typeof window !== "undefined") {
  try {
    const storedTheme = localStorage.getItem("app-theme") || "pink";
    const storedWp = localStorage.getItem("app-wallpaper-url") || "";
    const storedWpEnabled = localStorage.getItem("app-wallpaper-enabled");
    useThemeStore.setState({
      theme: storedTheme,
      wallpaperUrl: storedWp,
      wallpaperEnabled: storedWpEnabled === null ? true : storedWpEnabled === "true",
    });
  } catch (e) {
    // ignore
  }
}
