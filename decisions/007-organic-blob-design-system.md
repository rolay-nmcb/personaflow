# ADR-007: 有机 blob 设计系统（替代玻璃拟态）

## 状态

已采纳 — 2026-05，替代了此前的玻璃拟态 + AI 模板风格

## 背景

PersonaFlow 初版的 UI 具有典型的"AI 生成感"：
- 大量 sparkle (✨) SVG 图标出现在 logo、AI badge、feature、CTA 按钮等各处
- 渐变标题文字 (`gradient-text`) 过度使用
- 玻璃拟态卡片 (`glass-card` — `backdrop-filter: blur()`) 作为主要层次手段
- 三光球背景 + 漂浮预览卡片 `rotate(-3deg)` 是 AI 生成 landing page 的标志性套路
- Landing page 僵硬的 5-section 模板公式（Hero → Steps → Preview → Features → CTA）


## 决策

**用"有机玩味插画风"全面替代玻璃拟态 AI 模板风格。**

### 设计语言变更

| 维度 | 旧 | 新 |
|---|---|---|
| 卡片形状 | 统一 `border-radius: 24px` | 不规则 blob 圆角 (`30% 70% 70% 30% / 28% 30% 70% 72%`) |
| 层次表达 | `backdrop-filter: blur(24px)` 玻璃模糊 | 彩色多层 `box-shadow`（`--pf-shadow-card` / `--pf-shadow-soft`）|
| 标题 | gradient-text 渐变文字 | 纯色 `font-black` 粗体 |
| 图标 | ✨ sparkle SVG 重复使用 | emoji + 数字编号 + 抽象微型 SVG |
| 背景装饰 | 3 个对称光球 `blur(120px)` | 1-2 个有机 blob + 循环变形动画 `blobMorph` |
| 区域标识 | chip 标签 + sparkle | 大数字 01/02/03 |
| 选项卡片 | 方正圆角 + 等比 scale hover | 不规则圆角 + 右移 `translateX(4px)` + 弹性缩放 |
| 进度 | 条状 + gradient bar | 有机圆点阵列 `progress-dot` |
| 动画 | 统一 `fadeIn/slideUp 0.5s` | Spring 弹性 + 错位节奏 + `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| 文案 | "AI 驱动的智能人格探索平台" | 简洁直接的人话 |

### 新增 CSS 工具类

- `blob-card` / `blob-card-alt` / `blob-card-subtle` — 三种有机卡片变体
- `option-blob` / `option-blob-selected` — 答题选项
- `bg-dots` — 点阵背景（替代浮动粒子）
- `progress-dot` + `.active` / `.done` — 有机进度点
- `blobMorph` 关键帧动画 — 8s 循环变换 blob 形状
- 阴影 token: `--pf-shadow-soft` / `--pf-shadow-card` / `--pf-shadow-glow`

### 改动范围

11 个文件：`globals.css`、5 个主题文件、首页、答题页、结果页、专属页渲染器、Navbar、登录/注册、3 套内容模板。

## 备选方案

### 方案 B: 温和优化（仅替换 sparkle + gradient-text）
- 优点：改动小，风险低
- 未选原因：无法消除深层"AI 模板感"；glass-card 本身有可读性问题（模糊背景上叠加文字）

### 方案 C: 引入组件库（shadcn/ui, Radix）
- 优点：专业维护，无障碍内置
- 未选原因：增加 bundle 依赖；破坏现有设计语言；组件库自带"另一种模板感"

## 后果

### 正面
- 页面从 5 section 缩减为 4 个（Hero + 我的问卷 + 亮点 + CTA），更紧凑
- 有机 blob 形状在 5 套主题下各有不同的视觉新鲜感
- 阴影替代模糊避免了 `backdrop-filter` 的性能开销和阅读性问题
- 删除 sparkle 图标后，页面不再"一眼 AI"

### 负面
- blob 动画 `blobMorph` 在低性能设备上可能有卡顿
- 不规则圆角需要手动调节比例，不像统一 `border-radius` 那样完全一致
- 设计缺乏传统 UI 框架的"规范性"，未来新加入的开发者可能不习惯

### 经验
- 设计是一个迭代过程——先有玻璃拟态，再根据反馈重构为有机风格
- "减少 AI 味"的核心不是去掉 AI 功能，而是去掉 AI 生成 UI 的套路性视觉模式
