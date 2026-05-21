# ADR-003: Supabase Edge Functions 后端架构

## 状态

已采纳 — 2026-03

## 背景

PersonaFlow 的后端逻辑包括：调用 AI API 生成问卷/画像/页面、写入数据库、上传图像到 Storage。传统做法是搭建 Express/FastAPI 服务器 + 数据库 + 对象存储，但一人团队维护这些基础设施成本过高。

## 决策

**全部后端逻辑用 Supabase Edge Functions (Deno) 实现，零自建服务器。**

6 个 Edge Function 及调用链：

```
前端 invoke("generate-questionnaire")     → AI 生成问卷 + 写入 DB
                                      ↓
前端 invoke("generate-questionnaire-visual") → AI 生成封面图 + 上传 Storage
                                      
前端 invoke("analyze-persona")       → AI 分析答题数据 → 写入 persona_results
                                      ↓
前端 invoke("generate-page")         → AI 生成页面配置 → 写入 generated_pages
                                      ↓
前端 invoke("generate-page-visual")  → AI 生成页面图 + 上传 Storage

公开问卷: supabase.functions.invoke("submit-public-response")
            → 一次性跑完上述 5 步（匿名 user_id=null）
```

每个函数通过 `createClient(SUPABASE_URL, SERVICE_ROLE_KEY)` 与数据库内网直连，绕过 RLS 写入。

## 备选方案

### 方案 B: Next.js API Routes + Route Handlers
- 优点：和前端同仓库，无需额外部署
- 未选原因：Serverless function 超时较短 (vercel: 10-60s)；AI 调用和图像生成可能超时；与 Supabase DB 不在同一网络需走公网

### 方案 C: 独立 Express/FastAPI 服务
- 优点：完全控制运行环境，无超时限制
- 未选原因：需要自己部署、监控、扩缩；一人团队维护成本过高

## 后果

### 正面
- 零运维：Supabase 管理部署、扩缩、日志
- 与 PostgreSQL 内网直连，延迟低
- TypeScript 全栈，类型可复用
- Deno 原生支持 TypeScript，无需额外构建步骤

### 负面
- 冷启动延迟（首次调用 ~1-2s）
- 执行超时 400s，极限场景不够用（当前未触发）
- `jsr:` 和 `npm:` 包生态系统不如 Node.js 丰富
- Edge Function 部署后不可直接 SSH 调试，依赖日志排查

### 经验
- `supabase functions deploy` 部署后立即生效，比传统 CI/CD 快
- 本地开发用 `supabase functions serve --no-verify-jwt` 可以绕过认证调试
