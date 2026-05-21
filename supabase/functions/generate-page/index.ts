import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
const DEEPSEEK_BASE = "https://api.deepseek.com/v1";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ALLOWED_SECTION_TYPES = [
  "tag-list",
  "score-chart",
  "text-card",
  "quote-card",
  "highlight-card",
] as const;

const SYSTEM_PROMPT = `你是一个专业的页面设计配置生成器。
请根据用户画像数据生成一个专属页面配置 JSON。

要求：
1. 输出严格 JSON，不要输出 Markdown 代码块，不要有任何额外文字。
2. JSON 结构：
{
  "style": { "theme": "主题名", "primaryColor": "#7C8CFF", "backgroundType": "gradient" },
  "hero": { "title": "页面大标题", "subtitle": "副标题", "description": "一段描述" },
  "sections": [
    { "type": "tag-list", "title": "区块标题", "items": ["标签1","标签2",...] },
    { "type": "score-chart", "title": "区块标题", "data": {"维度": 分数,...} },
    { "type": "text-card", "title": "区块标题", "content": "文本内容" },
    { "type": "quote-card", "content": "引用文字" },
    { "type": "highlight-card", "title": "区块标题", "content": "高亮内容" }
  ]
}
3. style.primaryColor 必须是合法的 hex 颜色值（如 #7C8CFF）。
4. sections 数量为 3 到 5 个，必须包含至少一个 tag-list 和一个 score-chart。
5. 每个 section 必须包含 type 字段，type 只能是：tag-list、score-chart、text-card、quote-card、highlight-card。
6. tag-list 必须包含 items 数组，score-chart 必须包含 data 对象。
7. 禁止生成 HTML、JavaScript、iframe 或外部链接。
8. 输出语言为中文。
9. 主题配色应与画像气质匹配，例如理性气质用冷色调，热情气质用暖色调。`;

interface PageSection {
  type: (typeof ALLOWED_SECTION_TYPES)[number];
  title?: string;
  items?: string[];
  data?: Record<string, number>;
  content?: string;
}

interface PageConfig {
  style: { theme: string; primaryColor: string; backgroundType: string };
  hero: { title: string; subtitle: string; description: string };
  sections: PageSection[];
}

function extractJson(text: string): string {
  const cleaned = text.trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const objMatch = cleaned.match(/(\{[\s\S]*\})/);
  if (objMatch?.[1]) return objMatch[1].trim();
  return cleaned;
}

function validatePageConfig(data: unknown): PageConfig {
  if (!data || typeof data !== "object") throw new Error("返回数据不是对象");
  const pc = data as Record<string, unknown>;

  if (!pc.style || typeof pc.style !== "object") throw new Error("缺少 style");
  const style = pc.style as Record<string, unknown>;
  if (typeof style.theme !== "string") throw new Error("style.theme 缺失");
  if (typeof style.primaryColor !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(style.primaryColor)) {
    throw new Error("style.primaryColor 必须是合法 hex 颜色");
  }

  if (!pc.hero || typeof pc.hero !== "object") throw new Error("缺少 hero");
  const hero = pc.hero as Record<string, unknown>;
  if (typeof hero.title !== "string" || !hero.title.trim()) throw new Error("hero.title 缺失");
  if (typeof hero.subtitle !== "string") throw new Error("hero.subtitle 缺失");
  if (typeof hero.description !== "string") throw new Error("hero.description 缺失");

  if (!Array.isArray(pc.sections) || pc.sections.length < 1 || pc.sections.length > 6) {
    throw new Error("sections 数量必须在 1-6 之间");
  }

  for (let i = 0; i < pc.sections.length; i++) {
    const sec = pc.sections[i] as Record<string, unknown>;
    if (!ALLOWED_SECTION_TYPES.includes(sec.type as typeof ALLOWED_SECTION_TYPES[number])) {
      throw new Error(`第 ${i + 1} 个 section type "${sec.type}" 不在白名单内`);
    }
    switch (sec.type) {
      case "tag-list":
        if (!Array.isArray(sec.items) || sec.items.length === 0) {
          throw new Error(`第 ${i + 1} 个 tag-list section 缺少 items`);
        }
        break;
      case "score-chart":
        if (!sec.data || typeof sec.data !== "object" || Object.keys(sec.data as object).length === 0) {
          throw new Error(`第 ${i + 1} 个 score-chart section 缺少 data`);
        }
        break;
      case "text-card":
      case "highlight-card":
        if (typeof sec.title !== "string" && typeof sec.content !== "string") {
          throw new Error(`第 ${i + 1} 个 ${sec.type} section 内容缺失`);
        }
        break;
    }
  }

  return pc as unknown as PageConfig;
}

function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "未登录" }), { status: 401, headers: corsHeaders });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "认证失败" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const personaResultId = body.personaResultId;
    if (!personaResultId || typeof personaResultId !== "string") {
      return new Response(JSON.stringify({ error: "缺少 personaResultId" }), { status: 400, headers: corsHeaders });
    }

    // 查询画像结果
    const { data: persona, error: personaErr } = await supabase
      .from("persona_results")
      .select("*")
      .eq("id", personaResultId)
      .single();

    if (personaErr || !persona) {
      return new Response(JSON.stringify({ error: "画像结果不存在" }), { status: 404, headers: corsHeaders });
    }
    if (persona.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "无权访问此画像" }), { status: 403, headers: corsHeaders });
    }

    const personaData = {
      title: persona.title,
      summary: persona.summary,
      tags: persona.tags,
      dimensionScores: persona.dimension_scores,
      matchedResult: persona.matched_result,
      suggestions: persona.suggestions,
    };

    const userPrompt = JSON.stringify(personaData, null, 2);

    // 调用 AI
    let pageConfig: PageConfig;
    try {
      const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`DeepSeek API 错误 (${res.status}): ${errText}`);
      }

      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new Error("DeepSeek 返回内容为空");

      const extracted = extractJson(content);
      let parsed: unknown;
      try {
        parsed = JSON.parse(extracted);
      } catch {
        throw new Error(`JSON 解析失败，AI 返回: ${content.slice(0, 200)}`);
      }

      pageConfig = validatePageConfig(parsed);
    } catch (aiErr: unknown) {
      console.error("第一次页面配置生成失败，重试中...", (aiErr as Error).message);
      const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.9,
          max_tokens: 4096,
        }),
      });
      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      const extracted = extractJson(content);
      pageConfig = validatePageConfig(JSON.parse(extracted));
    }

    // 生成唯一 slug
    let shareSlug = generateSlug();
    let slugExists = true;
    while (slugExists) {
      const { data: existing } = await supabase
        .from("generated_pages")
        .select("id")
        .eq("share_slug", shareSlug)
        .maybeSingle();
      if (!existing) {
        slugExists = false;
      } else {
        shareSlug = generateSlug();
      }
    }

    // 写入
    const { data: page, error: insertErr } = await supabase
      .from("generated_pages")
      .insert({
        persona_result_id: personaResultId,
        user_id: user.id,
        page_config: pageConfig as unknown as Record<string, unknown>,
        share_slug: shareSlug,
        is_public: true,
      })
      .select()
      .single();

    if (insertErr || !page) {
      throw new Error(`写入页面配置失败: ${insertErr?.message}`);
    }

    return new Response(JSON.stringify({
      generatedPageId: page.id,
      shareSlug: shareSlug,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "服务器内部错误";
    console.error("generate-page error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
