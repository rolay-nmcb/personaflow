export type ThemeId = "blue-purple" | "pink-white" | "emerald" | "sunset" | "midnight";

export const THEME_ORDER: ThemeId[] = ["blue-purple", "pink-white", "emerald", "sunset", "midnight"];

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  emoji: string;
  previewColor: string;
  isDark: boolean;
}

export const THEME_META: Record<ThemeId, ThemeMeta> = {
  "blue-purple": {
    id: "blue-purple",
    label: "蓝紫幻境",
    emoji: "💜",
    previewColor: "#7C3AED",
    isDark: true,
  },
  "pink-white": {
    id: "pink-white",
    label: "粉白梦境",
    emoji: "🌸",
    previewColor: "#E11D48",
    isDark: false,
  },
  emerald: {
    id: "emerald",
    label: "翠绿森语",
    emoji: "🌿",
    previewColor: "#10B981",
    isDark: true,
  },
  sunset: {
    id: "sunset",
    label: "落日余晖",
    emoji: "🌅",
    previewColor: "#F97316",
    isDark: true,
  },
  midnight: {
    id: "midnight",
    label: "午夜深海",
    emoji: "🌙",
    previewColor: "#8B5CF6",
    isDark: true,
  },
};

export const ALL_THEMES = THEME_ORDER.map((id) => THEME_META[id]);

export const STORAGE_KEY = "personaflow-theme";
