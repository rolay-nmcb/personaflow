# ADR-005: 匿名优先的公开问卷流转

## 状态

已采纳 — 2026-04

## 背景

早期版本中，通过分享链接答题的用户在答完后被强制要求登录才能看结果。登录后问卷页面消失，用户不知道结果在哪——转化漏斗断裂。

需要让匿名用户也能完整体验：答题 → 看画像 → 看专属页面，注册是可选的后续动作，而非阻断性门槛。

## 决策

**公开问卷提交时，在后端跑完完整流程（包含 AI 分析+页面生成+图像生成），匿名数据标记 `user_id = null`，RLS 策略允许读取关联到公开页面的匿名记录。**

### 核心实现：`submit-public-response` Edge Function

```
用户答题 → invoke("submit-public-response")
  ├── step 1: 验证问卷是公开的 (is_public = true)
  ├── step 2: 写入 responses (user_id = null)
  ├── step 3: 写入 response_answers
  ├── step 4: DeepSeek 分析 → 写入 persona_results (user_id = null)
  ├── step 5: DeepSeek 生成页面配置 → 写入 generated_pages (is_public = true, user_id = null)
  ├── step 6: 生成视觉 prompt → 豆包生成图像 → 上传 Storage
  └── return: { shareSlug, personaResultId }
```

### 数据库改动

```sql
-- 允许 user_id 为 null
ALTER TABLE persona_results ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE generated_pages ALTER COLUMN user_id DROP NOT NULL;

-- RLS 策略：匿名记录若关联公开页面则允许读取
CREATE POLICY public_can_read_persona_for_public_pages
  ON persona_results FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM generated_pages gp
    WHERE gp.persona_result_id = persona_results.id
      AND gp.is_public = true
  ));
```

### 前端流程

```
分享链接 /quiz/:slug
    ↓ (无需登录)
答题 → submit-public-response → 等待 (同步完成全流程)
    ↓
结果页 /result/:id (直接看到画像)
    ↓
查看专属页面 /page/:id
    ↓
底部: "想试试你自己的人格？" → 引导注册 (可选)
```

## 备选方案

### 方案 B: 注册后再看结果
- 优点：用户数据完整，方便后续触达
- 未选原因：阻断体验，分享场景下绝大多数用户会流失

### 方案 C: 先看简化版结果，登录后解锁完整版
- 优点：部分留存 + 不阻断
- 未选原因：需要维护两套结果展示；AI 生成的结果本身就需要时间，再分两步增加延迟

## 后果

### 正面
- 分享 → 答题 → 看结果流程无摩擦
- `submit-public-response` 一次调用完成全流程，前端只需等待不返回部分结果
- 匿名数据后续可通过 `user_id` 回填关联到注册用户

### 负面
- 匿名数据无 user_id，无法在"我的问卷"列表中回溯
- 每个匿名提交都会生成完整 AI 内容（有 API 费用），但这是增长必需的成本
- 图像同步生成导致用户等待较久（15-40s），但前期反馈表明用户更愿意等待完整结果

### 经验
- `verify_jwt: false` 是关键配置——Edge Function 必须主动在部署时或代码中关闭 JWT 校验才能接收匿名请求
- `service_role` key 绕过 RLS 是正确做法：Edge Function 是受信服务端代码，不应受用户级权限限制
