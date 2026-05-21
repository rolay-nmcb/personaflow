import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Providers from "@/components/Providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PersonaFlow — AI 智能问卷画像与专属页面生成平台",
  description: "一句话生成你的专属人格问卷。从主题到问卷，从答案到画像，再到专属页面 — 全链路 AI 驱动。",
  keywords: ["人格测试", "AI问卷", "心理测试", "性格分析", "PersonaFlow"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('personaflow-theme');
                  var tokens = {
                    "pink-white": {"--background":"#FDF2F4","--foreground":"#1E293B","--card":"#FFFFFF","--card-foreground":"#1E293B","--muted":"#F1F5F9","--muted-foreground":"#64748B","--border":"rgba(0,0,0,0.08)","--primary":"#E11D48","--primary-foreground":"#FFFFFF","--secondary":"#F1F5F9","--secondary-foreground":"#334155","--accent":"#F472B6","--accent-foreground":"#1E293B","--pf-purple":"#E11D48","--pf-indigo":"#F43F5E","--pf-blue":"#60A5FA","--pf-pink":"#F9A8D4","--pf-cyan":"#F472B6","--pf-navy":"#FDF2F4","--pf-panel":"#FFFFFF","--pf-glass":"rgba(0,0,0,0.04)","--pf-glass-border":"rgba(0,0,0,0.08)","--pf-glass-hover":"rgba(0,0,0,0.06)","--pf-glow-purple":"rgba(225,29,72,0.20)","--pf-glow-cyan":"rgba(244,114,182,0.15)","--pf-glow-pink":"rgba(249,168,212,0.15)","--pf-selection":"rgba(225,29,72,0.20)","--pf-text-highlight":"#BE123C","--pf-btn-shadow":"rgba(225,29,72,0.30)","--pf-option-hover":"rgba(0,0,0,0.04)","--pf-ai-badge-bg":"rgba(225,29,72,0.10)","--pf-ai-badge-border":"rgba(225,29,72,0.20)","--pf-ai-bubble-bg":"rgba(244,63,94,0.08)","--pf-ai-bubble-border":"rgba(244,63,94,0.20)","--pf-progress-glow":"rgba(244,114,182,0.40)","--pf-grid-line":"rgba(225,29,72,0.06)","--pf-star-dot":"rgba(225,29,72,0.15)","--pf-scrollbar-thumb":"rgba(0,0,0,0.12)","--pf-scrollbar-thumb-hover":"rgba(0,0,0,0.20)"},
                    "emerald":    {"--background":"#021209","--foreground":"#F8FAFC","--card":"#051E10","--muted":"#0A2E18","--muted-foreground":"#6B7280","--border":"rgba(255,255,255,0.10)","--primary":"#10B981","--secondary":"#0A2E18","--secondary-foreground":"#D1FAE5","--accent":"#6EE7B7","--pf-purple":"#10B981","--pf-indigo":"#34D399","--pf-blue":"#6EE7B7","--pf-pink":"#A7F3D0","--pf-cyan":"#6EE7B7","--pf-navy":"#021209","--pf-panel":"#051E10","--pf-glass":"rgba(255,255,255,0.06)","--pf-glass-border":"rgba(255,255,255,0.12)","--pf-glass-hover":"rgba(255,255,255,0.10)","--pf-glow-purple":"rgba(16,185,129,0.25)","--pf-glow-cyan":"rgba(110,231,183,0.20)","--pf-glow-pink":"rgba(167,243,208,0.15)","--pf-selection":"rgba(16,185,129,0.25)","--pf-text-highlight":"#6EE7B7","--pf-btn-shadow":"rgba(16,185,129,0.30)","--pf-option-hover":"rgba(255,255,255,0.06)","--pf-ai-badge-bg":"rgba(16,185,129,0.12)","--pf-ai-badge-border":"rgba(16,185,129,0.25)","--pf-ai-bubble-bg":"rgba(52,211,153,0.10)","--pf-ai-bubble-border":"rgba(52,211,153,0.25)","--pf-progress-glow":"rgba(110,231,183,0.40)","--pf-grid-line":"rgba(110,231,183,0.04)","--pf-star-dot":"rgba(255,255,255,0.10)","--pf-scrollbar-thumb":"rgba(255,255,255,0.10)","--pf-scrollbar-thumb-hover":"rgba(255,255,255,0.18)"},
                    "sunset":     {"--background":"#1A0F07","--foreground":"#F8FAFC","--card":"#231408","--muted":"#2D1B0A","--muted-foreground":"#9CA3AF","--border":"rgba(255,255,255,0.10)","--primary":"#F97316","--secondary":"#2D1B0A","--secondary-foreground":"#FED7AA","--accent":"#FBBF24","--pf-purple":"#F97316","--pf-indigo":"#FB923C","--pf-blue":"#FBBF24","--pf-pink":"#FDBA74","--pf-cyan":"#FBBF24","--pf-navy":"#1A0F07","--pf-panel":"#231408","--pf-glass":"rgba(255,255,255,0.06)","--pf-glass-border":"rgba(255,255,255,0.12)","--pf-glass-hover":"rgba(255,255,255,0.10)","--pf-glow-purple":"rgba(249,115,22,0.25)","--pf-glow-cyan":"rgba(251,191,36,0.20)","--pf-glow-pink":"rgba(253,186,116,0.15)","--pf-selection":"rgba(249,115,22,0.25)","--pf-text-highlight":"#FED7AA","--pf-btn-shadow":"rgba(249,115,22,0.30)","--pf-option-hover":"rgba(255,255,255,0.06)","--pf-ai-badge-bg":"rgba(249,115,22,0.12)","--pf-ai-badge-border":"rgba(249,115,22,0.25)","--pf-ai-bubble-bg":"rgba(251,146,60,0.10)","--pf-ai-bubble-border":"rgba(251,146,60,0.25)","--pf-progress-glow":"rgba(251,191,36,0.40)","--pf-grid-line":"rgba(251,191,36,0.04)","--pf-star-dot":"rgba(255,255,255,0.10)","--pf-scrollbar-thumb":"rgba(255,255,255,0.10)","--pf-scrollbar-thumb-hover":"rgba(255,255,255,0.18)"},
                    "midnight":   {"--background":"#0A0E1A","--foreground":"#F8FAFC","--card":"#0D1224","--muted":"#1A2040","--muted-foreground":"#94A3B8","--border":"rgba(255,255,255,0.10)","--primary":"#8B5CF6","--secondary":"#1A2040","--secondary-foreground":"#CBD5E1","--accent":"#38BDF8","--pf-purple":"#8B5CF6","--pf-indigo":"#A78BFA","--pf-blue":"#38BDF8","--pf-pink":"#E9D5FF","--pf-cyan":"#38BDF8","--pf-navy":"#0A0E1A","--pf-panel":"#0D1224","--pf-glass":"rgba(255,255,255,0.06)","--pf-glass-border":"rgba(255,255,255,0.12)","--pf-glass-hover":"rgba(255,255,255,0.10)","--pf-glow-purple":"rgba(139,92,246,0.25)","--pf-glow-cyan":"rgba(56,189,248,0.20)","--pf-glow-pink":"rgba(233,213,255,0.15)","--pf-selection":"rgba(139,92,246,0.25)","--pf-text-highlight":"#C4B5FD","--pf-btn-shadow":"rgba(139,92,246,0.30)","--pf-option-hover":"rgba(255,255,255,0.06)","--pf-ai-badge-bg":"rgba(139,92,246,0.12)","--pf-ai-badge-border":"rgba(139,92,246,0.25)","--pf-ai-bubble-bg":"rgba(167,139,250,0.10)","--pf-ai-bubble-border":"rgba(167,139,250,0.25)","--pf-progress-glow":"rgba(56,189,248,0.40)","--pf-grid-line":"rgba(56,189,248,0.04)","--pf-star-dot":"rgba(255,255,255,0.10)","--pf-scrollbar-thumb":"rgba(255,255,255,0.10)","--pf-scrollbar-thumb-hover":"rgba(255,255,255,0.18)"}
                  };
                  if (theme && tokens[theme]) {
                    var vars = tokens[theme];
                    for (var key in vars) {
                      document.documentElement.style.setProperty(key, vars[key]);
                    }
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
