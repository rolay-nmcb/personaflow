"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { type ThemeId, ALL_THEMES, STORAGE_KEY, THEME_META } from "./constants";
import { getThemeTokens } from "./themes";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
  isDark: boolean;
  allThemes: typeof ALL_THEMES;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = "blue-purple",
}: {
  children: ReactNode;
  defaultTheme?: ThemeId;
}) {
  const [theme, setThemeState] = useState<ThemeId>(defaultTheme);
  const [mounted, setMounted] = useState(false);

  // Restore theme from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
      if (stored && THEME_META[stored]) {
        setThemeState(stored);
      } else {
        const prefersDark = window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;
        setThemeState(prefersDark ? "blue-purple" : "pink-white");
      }
    } catch {
      // localStorage unavailable
    }
    setMounted(true);
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Apply CSS variables to :root based on current theme
  useEffect(() => {
    if (!mounted) return;
    const tokens = getThemeTokens(theme);
    const root = document.documentElement;
    for (const [key, value] of Object.entries(tokens)) {
      root.style.setProperty(key, value);
    }
  }, [theme, mounted]);

  const value: ThemeContextValue = {
    theme,
    setTheme,
    isDark: THEME_META[theme]?.isDark ?? true,
    allThemes: ALL_THEMES,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
