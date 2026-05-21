# ADR-001: Next.js 16 + Supabase 技术栈选型

## 状态

已采纳 — 2026-03

## 背景

PersonaFlow 是一个 AI 驱动的问卷生成与人格画像平台。核心需求：

- 前端需要良好的 SEO（分享页面可被社交平台抓取）和快速首屏
- 后端需要数据库、用户认证、文件存储、服务端函数，但团队只有一人
- 需要与多家 AI 供应商（DeepSeek、豆包）集成
- 预计用户量从零起步，初期不需要复杂微服务

## 决策

**全栈选用 Next.js 16 (App Router) + Supabase**。

| 层 | 选型 | 理由 |
|---|---|---|
| 前端框架 | Next.js 16 + React 19 | App Router 支持 RSC + SSR；分享页 SEO 友好；Turbopack 构建快 |
| 样式 | Tailwind CSS v4 | 原子化 CSS + `@theme inline` 绑定 CSS 变量；v4 移除 tailwind.config |
| 数据库 | Supabase PostgreSQL | 托管 Postgres + 内置 Auth + RLS 行级安全 |
| 后端逻辑 | Supabase Edge Functions (Deno) | 零运维、与 DB 内网直连、TypeScript 原生、全球边缘部署 |
| 文件存储 | Supabase Storage | 存 AI 生成的背景图和头像 |
| 类型安全 | TypeScript + Supabase 自动类型生成 | `generate_typescript_types` 保持前后端类型一致 |

## 备选方案

### 方案 B: Vercel + Next.js + Prisma + PlanetScale
- 优点：Vercel 生态更成熟，Next.js 作者同公司
- 未选原因：需要单独管理 Auth (NextAuth/Clerk)、Storage (Cloudinary/S3)、Serverless 函数；集成点多，运维负担大

### 方案 C: 纯 Python 后端 (FastAPI) + React SPA
- 优点：Python AI 生态更丰富
- 未选原因：前后端分离增加部署和类型同步成本；一人在两个语言间切换效率低

## 后果

### 正面
- 一个 Supabase 项目覆盖 Auth + DB + Storage + Edge Functions，省去 4-5 个第三方集成
- TypeScript 全栈，类型可从前端透传到 Edge Function
- RLS 策略在数据库层做权限控制，比应用层中间件更安全

### 负面
- Supabase Edge Functions 基于 Deno，部分 Node.js 包不兼容（需用 `jsr:` 前缀或 Deno 兼容包）
- Edge Function 冷启动 + 执行时间限制（最长 400s），长任务需拆分为异步
- 豆包 API 服务器在中国，Edge Function 从全球节点访问偶现 TCP 超时 → 见 ADR-006

### 经验
- Supabase 的 `service_role` key 可以绕过 RLS，适合 Edge Function 内部写入匿名用户数据
- Edge Function 日志只能通过 `get_logs` MCP 工具或 Supabase Dashboard 查看，本地调试需用 `supabase functions serve`
