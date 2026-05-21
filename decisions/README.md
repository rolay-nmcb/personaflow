# Architecture Decision Records

PersonaFlow 项目的关键技术决策记录。

| # | 标题 | 决策摘要 |
|---|---|---|
| 001 | [技术栈选型](001-tech-stack-nextjs-supabase.md) | Next.js 16 + Supabase (PostgreSQL + Auth + Storage + Edge Functions) 作为全栈基础 |
| 002 | [AI 双供应商策略](002-dual-ai-providers.md) | DeepSeek 做文本生成，豆包(seedream) 做图像生成，各取所长 |
| 003 | [边缘函数架构](003-edge-functions-architecture.md) | 6 个 Supabase Edge Functions 替代传统后端，零自建服务器 |
| 004 | [CSS 变量主题系统](004-css-variable-theming.md) | CSS 自定义属性 + React Context + inline script 防闪烁，5 套主题可切换 |
| 005 | [匿名问答流转](005-anonymous-quiz-flow.md) | 公开问卷匿名提交 → 同步完成全流程 AI 分析 → 完整体验，注册可选 |
| 006 | [图像重试策略](006-image-retry-resilience.md) | 90s 超时 + 指数退避重试 3 次 + Promise.allSettled 并行，解决跨境 TCP 超时 |
| 007 | [有机 blob 设计系统](007-organic-blob-design-system.md) | 有机 blob 形状 + 彩色软影 + emoji/数字替代 sparkle 图标，消除 AI 模板感 |

## 格式

采用简化 MADR 格式：背景 → 决策 → 备选方案 → 后果。
