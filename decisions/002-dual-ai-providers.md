# ADR-002: AI 双供应商策略 (DeepSeek + 豆包)

## 状态

已采纳 — 2026-03

## 背景

PersonaFlow 依赖两类 AI 能力：

1. **文本生成**：问卷题目设计、人格画像分析、专属页面配置、视觉 prompt 生成
2. **图像生成**：问卷封面图、专属页面背景图、Hero 图

单一供应商难以同时覆盖两类任务的高质量输出。需要根据任务特点选择最优供应商。

## 决策

**DeepSeek 负责全部文本生成，豆包 (Doubao/Volces) 负责全部图像生成。**

| 任务 | 供应商 | 模型 | 理由 |
|---|---|---|---|
| 问卷生成 | DeepSeek | `deepseek-chat` | JSON 结构化输出 (`response_format: json_object`)，中文质量好，价格低 |
| 画像分析 | DeepSeek | `deepseek-chat` | 同上 |
| 页面配置 | DeepSeek | `deepseek-chat` | 生成 page_config JSON |
| 视觉 prompt | DeepSeek | `deepseek-chat` | 先分析画像再写中文图 prompt |
| 封面图 | 豆包 | `doubao-seedream-5-0-260128` | 中文 prompt 理解力强，控图精细 |
| 背景/Hero 图 | 豆包 | 同上 | 同上 |

DeepSeek API 使用 OpenAI 兼容格式 (`/chat/completions`)，豆包使用自有格式 (`/images/generations`)。

## 备选方案

### 方案 B: 全部用 OpenAI（GPT-4o + DALL-E 3）
- 优点：单一供应商，统一 API 格式
- 未选原因：中文问卷质量不如 DeepSeek；DALL-E 中文 prompt 理解弱；成本高

### 方案 C: 全部用 DeepSeek（通过 Anthropic/OpenAI 兼容接口）
- 优点：DeepSeek 文本强 + 便宜
- 未选原因：DeepSeek 不支持 Native 图像生成，无法满足封面图和背景图需求

### 方案 D: 豆包全家桶（豆包文本 + 豆包图像）
- 优点：单一供应商
- 未选原因：豆包文本生成的 JSON 结构化输出不如 DeepSeek 稳定；DeepSeek API 的 `response_format: json_object` 参数强制 JSON 输出大幅降低解析失败率

## 后果

### 正面
- 文本和图像各自使用最优供应商，两项任务质量都很高
- DeepSeek 按 token 计费极低，适合频繁调用；豆包按张计费，适合按需生成
- 双供应商也意味着单点故障影响有限——一个挂了另一个仍然可用

### 负面
- 需要在两个 API 之间管理不同的认证和格式
- 豆包服务器在中国，跨境网络不稳定 → 见 ADR-006
- 无法在一个 API 调用中完成文本+图像（如 GPT-4o 的多模态），但当前任务不需要这种模式

### 经验
- 如果未来 DeepSeek 或豆包任意一方支持了缺失的能力，应重新评估是否合并为单一供应商
