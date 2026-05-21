export type TemplateId = "fantasy" | "healing" | "tech" | "romance";

export type TemplateConfig = {
  id: TemplateId;
  name: string;
  bgGradient: string;
  bgOverlay?: string;
  cardBg: string;
  cardBorder: string;
  cardRadius: string;
  cardShadow: string;
  heroTitleClass: string;
  heroImageStyle: { borderRadius: string; maxHeight: number; shadow: string };
  tagStyle: { bg: string; text: string; radius: string; border: string };
  barHeight: string;
  barRadius: string;
  barGlow: boolean;
  textColor: string;
  textSecondary: string;
  accentColor: string;
  accentGradient: string;
  showDecorations: boolean;
  decorationType: "particles" | "none" | "grid" | "hearts";
  fontClass: string;
};

export const templates: Record<TemplateId, TemplateConfig> = {
  fantasy: {
    id: "fantasy",
    name: "幻想冒险风",
    bgGradient: "from-[#070A18] via-[#1A1035] to-[#070A18]",
    bgOverlay:
      "radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.15) 0%, transparent 60%)",
    cardBg: "blob-card",
    cardBorder: "border border-primary/20",
    cardRadius: "",
    cardShadow: "",
    heroTitleClass: "text-foreground font-bold tracking-wide",
    heroImageStyle: {
      borderRadius: "24px",
      maxHeight: 260,
      shadow: "0 0 50px rgba(124,58,237,0.4)",
    },
    tagStyle: {
      bg: "bg-primary/15",
      text: "text-pf-purple",
      radius: "rounded-full",
      border: "border border-primary/30",
    },
    barHeight: "h-1.5",
    barRadius: "rounded-full",
    barGlow: true,
    textColor: "text-foreground",
    textSecondary: "text-muted-foreground",
    accentColor: "#7C3AED",
    accentGradient: "linear-gradient(135deg, #7C3AED, #6366F1, #22D3EE)",
    showDecorations: true,
    decorationType: "particles",
    fontClass: "font-sans",
  },
  healing: {
    id: "healing",
    name: "治愈文艺风",
    bgGradient: "from-[#fafafa] via-[#f5f5f5] to-[#fafafa]",
    bgOverlay: undefined,
    cardBg: "bg-card shadow-lg shadow-[#10B981]/08",
    cardBorder: "border border-[#D1FAE5]/50",
    cardRadius: "rounded-3xl",
    cardShadow: "shadow-lg shadow-emerald-100/50",
    heroTitleClass: "text-emerald-800 font-medium",
    heroImageStyle: {
      borderRadius: "32px",
      maxHeight: 240,
      shadow: "0 10px 40px rgba(16,185,129,0.15)",
    },
    tagStyle: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      radius: "rounded-2xl",
      border: "border-0",
    },
    barHeight: "h-4",
    barRadius: "rounded-full",
    barGlow: false,
    textColor: "text-emerald-800",
    textSecondary: "text-emerald-600/70",
    accentColor: "#10B981",
    accentGradient: "linear-gradient(135deg, #34D399, #6EE7B7)",
    showDecorations: false,
    decorationType: "none",
    fontClass: "font-serif",
  },
  tech: {
    id: "tech",
    name: "科技未来风",
    bgGradient: "from-[#070A18] via-[#0D1528] to-[#070A18]",
    bgOverlay: undefined,
    cardBg: "blob-card",
    cardBorder: "border border-accent/20",
    cardRadius: "",
    cardShadow: "",
    heroTitleClass: "text-foreground font-light tracking-widest",
    heroImageStyle: {
      borderRadius: "4px",
      maxHeight: 220,
      shadow: "0 0 30px rgba(34,211,238,0.3)",
    },
    tagStyle: {
      bg: "bg-accent/15",
      text: "text-accent",
      radius: "rounded",
      border: "border border-accent/25",
    },
    barHeight: "h-1",
    barRadius: "rounded-sm",
    barGlow: true,
    textColor: "text-blue-50",
    textSecondary: "text-blue-300/60",
    accentColor: "#22D3EE",
    accentGradient: "linear-gradient(135deg, #22D3EE, #6366F1, #7C3AED)",
    showDecorations: true,
    decorationType: "grid",
    fontClass: "font-mono",
  },
  romance: {
    id: "romance",
    name: "浪漫情感风",
    bgGradient: "from-[#070A18] via-[#1A1025] to-[#070A18]",
    bgOverlay:
      "radial-gradient(ellipse at 70% 20%, rgba(240,171,252,0.12) 0%, transparent 50%)",
    cardBg: "blob-card",
    cardBorder: "border border-pf-pink/20",
    cardRadius: "",
    cardShadow: "",
    heroTitleClass: "text-foreground font-semibold",
    heroImageStyle: {
      borderRadius: "999px",
      maxHeight: 280,
      shadow: "0 0 50px rgba(240,171,252,0.3)",
    },
    tagStyle: {
      bg: "bg-pf-pink/15",
      text: "text-pf-pink",
      radius: "rounded-full",
      border: "border border-pf-pink/25",
    },
    barHeight: "h-1.5",
    barRadius: "rounded-full",
    barGlow: true,
    textColor: "text-pink-50",
    textSecondary: "text-pink-200/70",
    accentColor: "#F0ABFC",
    accentGradient: "linear-gradient(135deg, #EC4899, #F0ABFC, #FBCFE8)",
    showDecorations: true,
    decorationType: "hearts",
    fontClass: "font-sans",
  },
};

const themeMap: Record<string, TemplateId> = {
  fantasy: "fantasy",
  "幻想冒险风": "fantasy",
  "fantasy-anime": "fantasy",
  genshin: "fantasy",
  anime: "fantasy",
  healing: "healing",
  "治愈文艺风": "healing",
  minimalist: "healing",
  mbti: "healing",
  personality: "healing",
  tech: "tech",
  "科技未来风": "tech",
  futuristic: "tech",
  career: "tech",
  study: "tech",
  learning: "tech",
  romance: "romance",
  "浪漫情感风": "romance",
  love: "romance",
};

export function detectTemplate(theme?: string, tags?: string[]): TemplateId {
  const t = (theme || "").toLowerCase();
  for (const [k, v] of Object.entries(themeMap)) {
    if (t.includes(k)) return v;
  }
  if (tags) {
    const tagStr = tags.join("");
    if (tagStr.includes("角色") || tagStr.includes("冒险") || tagStr.includes("幻想"))
      return "fantasy";
    if (tagStr.includes("职业") || tagStr.includes("科技") || tagStr.includes("学习"))
      return "tech";
    if (tagStr.includes("恋爱") || tagStr.includes("心动") || tagStr.includes("浪漫"))
      return "romance";
  }
  return "healing";
}
