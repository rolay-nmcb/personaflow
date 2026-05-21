# ADR-006: 图像生成的网络重试策略

## 状态

已采纳 — 2026-04，迭代更新于 2026-05

## 背景

豆包图像 API (`ark.cn-beijing.volces.com`) 的服务器位于中国，而 Supabase Edge Functions 从全球边缘节点发起请求。跨境 TCP 连接间歇性超时：

```
TypeError: Connection timed out (os error 110)
ETIMEDOUT: Connect timeout
```

早期版本无重试，一次失败即抛出错误，导致生成问卷封面和专属页面背景的失败率高达 40-50%。

同时，初始使用的图像尺寸 `1024x576`（589,824 px）低于豆包最低要求 3,686,400 px，导致 `InvalidParameter` 参数错误。

## 决策

### 1. 图像尺寸修正
```typescript
// 之前 (broken): size: "1024x576"  // 589,824 px → API 拒绝
// 之后:           size: "2048x2048"  // 4,194,304 px → 符合最小要求
```

### 2. 网络超时 + 指数退避重试
```typescript
async function generateImage(prompt: string, style: string, retries = 2): Promise<Blob> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${DOUBAO_BASE}/images/generations`, {
        signal: AbortSignal.timeout(90000),  // 90s 超时
        // ...
      });
      // ... 处理响应
      return blob;
    } catch (err) {
      const msg = (err as Error).message;
      const isNetworkError = msg.includes("timeout")
        || msg.includes("ETIMEDOUT")
        || msg.includes("Connect");

      if (attempt < retries && isNetworkError) {
        await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt)));
        continue;  // 2s, 4s 退避后重试
      }
      throw err;  // API 错误不重试
    }
  }
}
```

### 3. 并行生成
```typescript
// 背景图和 Hero 图同时生成，不串行等待
const [bgResult, heroResult] = await Promise.allSettled([
  generateImage(bgPrompt, style),
  generateImage(heroPrompt, style),
]);
```

任一失败不影响另一张的上传和使用。

### 应用范围

此策略应用于 3 个 Edge Function：`generate-questionnaire-visual`、`generate-page-visual`、`submit-public-response`。

## 备选方案

### 方案 B: 增加超时时间到 180s 但不重试
- 优点：实现简单
- 未选原因：长超时仍无法解决 TCP 连接建立阶段的失败（Connect timeout）

### 方案 C: 接入 CDN 代理或第三方图床中转
- 优点：绕过直连问题
- 未选原因：增加中间层复杂性；代理本身也有可靠性问题

## 后果

### 正面
- 失败率从 40-50% 降至接近 0%（3 次尝试 + 指数退避足以覆盖绝大多数间歇性网络波动）
- Promise.allSettled 保证至少有一张图可用，不会有完全空白的状态
- API 层面的错误（如 InvalidParameter）不会被错误重试

### 负面
- 最坏情况等待时间：3 次 × 90s = 270s，仍在 Edge Function 400s 限制内
- 前端用户体验：原本 8s 完成（无重试成功），现在可能 8-98s（取决于重试次数）

### 经验
- `AbortSignal.timeout()` 是 Deno 原生支持的，比手动 `setTimeout + AbortController` 简洁
- 区分网络错误和 API 错误的重试策略是关键——API 错误（400、403）重试无意义
- 未来如果豆包提供海外 endpoint，可考虑移除重试逻辑
