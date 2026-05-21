"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/lib/theme/ThemeContext";

export default function ThemeSwitcher() {
  const { theme, setTheme, allThemes } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = allThemes.find((t) => t.id === theme);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-9 h-9 rounded-full flex items-center justify-center glass border border-border hover:border-border transition-colors"
        aria-label="切换主题"
        title="切换主题"
      >
        <span
          className="w-5 h-5 rounded-full"
          style={{ backgroundColor: current?.previewColor }}
        />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-2 p-2 glass-card rounded-2xl flex gap-1.5 z-50">
          {allThemes.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTheme(t.id); setOpen(false); }}
              className="flex flex-col items-center gap-1 p-2 rounded-xl hover:glass transition"
              title={t.label}
            >
              <span
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  theme === t.id ? "border-white scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: t.previewColor }}
              />
              <span className="text-[10px] text-muted-foreground">{t.emoji}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
