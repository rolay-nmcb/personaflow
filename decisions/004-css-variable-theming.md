# ADR-004: CSS 变量 + React Context 主题系统

## 状态

已采纳 — 2026-04

## 背景

项目最初只有蓝紫暗色系一套配色（硬编码 hex 值）。用户要求支持多套主题切换：粉白（浅色）、翠绿、落日、午夜等。需要一套可扩展的主题系统，同时满足 SSR 首屏不闪烁、运行时动态切换。

## 决策

**CSS 自定义属性 + React ThemeProvider Context + localStorage 持久化 + inline script 防闪烁。**

### 架构三层

```
Layer 1: 定义 token（themes.ts）
  getThemeTokens(themeId) → Record<string, string>
  ~35 个 CSS 变量：background, foreground, card, primary, accent, 
  pf-purple/indigo/cyan 等品牌色, glass, glow, shadow, scrollbar...

Layer 2: React Context 管理状态（ThemeContext.tsx）
  useState → setTheme → localStorage.setItem
  useEffect → getThemeTokens → document.documentElement.style.setProperty

Layer 3: Tailwind @theme inline 桥接（globals.css）
  @theme inline { --color-primary: var(--primary); ... }
  所有组件用 Tailwind class: bg-primary, text-foreground 等
```

### 防闪烁

`layout.tsx` 的 `<head>` 中插入 inline `<script>`，在 React hydrate 前读取 localStorage 并设置 CSS 变量，保证首帧就是正确主题。

### 5 套预定义主题

| ID | 名称 | isDark | 基准色 |
|---|---|---|---|
| `blue-purple` | 蓝紫幻境 | true | #7C3AED |
| `pink-white` | 粉白梦境 | false | #E11D48 |
| `emerald` | 翠绿森语 | true | #10B981 |
| `sunset` | 落日余晖 | true | #F97316 |
| `midnight` | 午夜深海 | true | #8B5CF6 |

## 备选方案

### 方案 B: Tailwind `dark:` + `data-theme` 属性
- 优点：纯 CSS，不依赖 JS runtime
- 未选原因：只能做 dark/light 两态切换；5 套主题需要 5 倍 class 组合爆炸

### 方案 C: CSS-in-JS（styled-components / Panda CSS）
- 优点：类型安全，主题对象直接 import
- 未选原因：增加 bundle 体积；SSR 配置复杂；与 Tailwind 工作流冲突

### 方案 D: 仅依赖 `prefers-color-scheme`
- 优点：零 JS，跟随系统
- 未选原因：无法手动切换；无法实现 5 套主题

## 后果

### 正面
- 添加新主题只需在 themes.ts 加一个对象，零组件改动
- SSR 安全：初始渲染不依赖 JS
- 切换瞬时（只改 CSS 变量，不触发 re-render）
- 所有 11 个页面组件通过 Tailwind class 自动适配主题

### 负面
- Inline script 在 `layout.tsx` 中维护了 4 套主题 token 的副本（用于防闪烁），与 themes.ts 存在重复，修改主题需两处同步
- 浅色主题（pink-white）的对比度在部分组件上需要手动微调

### 经验
- `@theme inline` 是 Tailwind v4 的关键特性，让 CSS 变量能被 `bg-primary` 等 class 直接引用
- `color-mix(in srgb, ...)` 让动态透明度成为可能，无需为每个颜色定义所有 alpha 变体
