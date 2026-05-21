# PersonaFlow

一句话生成你的专属人格宇宙。输入任意主题，AI 自动生成沉浸式问卷、分析你的选择、为你创建独一无二的专属页面。

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Next.js 16 + React 19 + Tailwind CSS v4 + Framer Motion |
| 后端 | Supabase Edge Functions (Deno) |
| 数据库 | Supabase PostgreSQL + RLS 行级安全 |
| 认证 | Supabase Auth |
| 存储 | Supabase Storage |
| AI | DeepSeek (文本) + 豆包 Seedream (图像) |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

### 环境变量

创建 `.env.local`：

```env
NEXT_PUBLIC_SUPABASE_URL=你的项目URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon key
```

### 部署 Edge Functions

```bash
npx supabase functions deploy generate-questionnaire
npx supabase functions deploy generate-questionnaire-visual
npx supabase functions deploy analyze-persona
npx supabase functions deploy generate-page
npx supabase functions deploy generate-page-visual
npx supabase functions deploy submit-public-response
```

每个函数需要在 Supabase Dashboard 中配置 `DEEPSEEK_API_KEY` 环境变量；涉及图像生成的函数还需要 `ARK_API_KEY`。

## 项目结构

```
src/
├── app/                     # Next.js App Router 页面
│   ├── page.tsx             # 首页：输入主题 + 生成问卷
│   ├── login/page.tsx       # 登录
│   ├── register/page.tsx    # 注册
│   ├── questionnaire/[id]/  # 答题页
│   ├── result/[id]/         # 结果页（人格画像）
│   ├── page/[id]/           # 专属页面
│   ├── quiz/[slug]/         # 公开分享的问卷（无需登录）
│   └── share/[slug]/        # 公开分享的结果页
├── components/              # 共享组件
│   ├── Navbar.tsx           # 导航栏 + 主题切换
│   ├── ThemeSwitcher.tsx    # 5 主题切换器
│   ├── Providers.tsx        # Auth + Theme Provider 包装
│   ├── ExclusivePageRenderer.tsx
│   ├── DynamicPageRenderer.tsx
│   └── templates/           # 专属页面模板配置
├── lib/
│   ├── supabase/            # Supabase 客户端 (client/server/middleware/auth)
│   └── theme/               # 主题系统 (constants/themes/ThemeContext)
└── app/globals.css          # 全局样式 + 设计 token + 工具类

supabase/functions/          # Edge Functions
├── generate-questionnaire/  # AI 生成问卷
├── generate-questionnaire-visual/  # AI 生成封面图
├── analyze-persona/         # AI 分析答题数据
├── generate-page/           # AI 生成专属页面配置
├── generate-page-visual/    # AI 生成页面视觉图
└── submit-public-response/  # 公开问卷匿名提交全流程

decisions/                   # 架构决策记录 (ADR)
```

## 核心特性

**5 主题切换** — 蓝紫幻境 / 粉白梦境 / 翠绿森语 / 落日余晖 / 午夜深海，CSS 变量驱动，首屏不闪烁。

**3 档问卷深度** — 轻量 (4~5 题) / 标准 (6~8 题) / 深度 (10~15 题)，按需选择画像精度。

**匿名优先体验** — 分享链接 → 答题 → 看完整体画像 → 可选注册，全程无阻断。

**有机 blob 设计** — 不规则卡片圆角 + 彩色软影 + 弹性动画，没有 sparkle 图标和 AI 套话。

**AI 图像生成** — 每份问卷和专属页面都有 AI 生成的视觉背景，风格跟随主题自动变化。

## 架构决策

重要技术决策记录在 [decisions/](decisions/) 目录下，包括技术栈选型、AI 双供应商策略、边缘函数架构、主题系统、匿名流转、图像重试策略和设计语言。
