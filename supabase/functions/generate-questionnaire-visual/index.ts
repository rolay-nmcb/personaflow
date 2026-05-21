import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const DOUBAO_API_KEY = Deno.env.get("DOUBAO_API_KEY")!;
const DOUBAO_BASE = "https://ark.cn-beijing.volces.com/api/v3";
const DEEPSEEK_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const VISUAL_PROMPT_SYSTEM = `你是一个专业的视觉设计 prompt 工程师。
根据问卷的主题、标题和简介，生成高质量的中文图像生成 prompt。

要求：
1. 输出一个 JSON：{"bgPrompt": "背景图prompt", "heroPrompt": "封面图prompt"}
2. bgPrompt 描述一个适合作为网页背景的氛围图，要有空间留白感，色调柔和，适合叠加文字卡片
3. heroPrompt 描述一个适合放在页面顶部的主视觉图，要有视觉冲击力
4. prompt 用中文，详细描述画面元素、色调、风格、氛围
5. 风格应与主题匹配，例如原神→幻想冒险风，恋爱→浪漫柔和风
6. 不要在 prompt 中出现具体角色名或 IP 名称
7. 画面不要包含文字`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function generatePrompt(questionnaire: { title: string; description: string; theme: string }) {
  console.log("[generate-questionnaire-visual] Calling DeepSeek for prompts...");
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: VISUAL_PROMPT_SYSTEM },
        { role: "user", content: `问卷主题：${questionnaire.theme}\n标题：${questionnaire.title}\n简介：${questionnaire.description}` },
      ],
      temperature: 0.8,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek prompt 生成失败 (${res.status}): ${errText.slice(0, 300)}`);
  }
  const json = await res.json();
  const content = json.choices[0].message.content;
  console.log("[generate-questionnaire-visual] Prompts generated");
  return JSON.parse(content) as { bgPrompt: string; heroPrompt: string };
}

async function generateImage(prompt: string, style: string, label: string, retries = 2): Promise<Blob> {
  const fullPrompt = `${prompt}。风格：${style}，高质量，精美细节`;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`[generate-questionnaire-visual] Generating ${label} image (attempt ${attempt + 1})...`);
      const res = await fetch(`${DOUBAO_BASE}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DOUBAO_API_KEY}`,
        },
        body: JSON.stringify({
          model: "doubao-seedream-5-0-260128",
          prompt: fullPrompt,
          sequential_image_generation: "disabled",
          response_format: "url",
          size: "2048x2048",
          stream: false,
          watermark: true,
        }),
        signal: AbortSignal.timeout(90000),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${label}生成失败 (${res.status}): ${errText.slice(0, 500)}`);
      }

      const json = await res.json();
      const imgUrl = json.data?.[0]?.url;
      if (imgUrl) {
        console.log(`[generate-questionnaire-visual] Downloading ${label}...`);
        const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(30000) });
        if (!imgRes.ok) throw new Error(`下载${label}失败: ${imgRes.status}`);
        return await imgRes.blob();
      }

      const b64 = json.data?.[0]?.b64_json;
      if (b64) {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: "image/png" });
      }

      throw new Error(`${label}返回为空。响应: ${JSON.stringify(json).slice(0, 300)}`);
    } catch (err) {
      lastErr = err;
      const msg = (err as Error).message || String(err);
      const isTimeout = msg.includes("timeout") || msg.includes("timed out") || msg.includes("ETIMEDOUT") || msg.includes("Connect");
      if (attempt < retries && isTimeout) {
        const delay = 2000 * Math.pow(2, attempt);
        console.warn(`[generate-questionnaire-visual] ${label} retry ${attempt + 1} after ${delay}ms (${msg.slice(0, 100)})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function uploadAndGetUrl(bucket: string, path: string, blob: Blob): Promise<string> {
  const { error: uploadErr } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType: "image/png", upsert: true });

  if (uploadErr) throw new Error(`上传失败: ${uploadErr.message}`);

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
  return urlData.publicUrl;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "未登录" }), { status: 401, headers: corsHeaders });
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "认证失败" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const questionnaireId = body.questionnaireId;
    if (!questionnaireId) {
      return new Response(JSON.stringify({ error: "缺少 questionnaireId" }), { status: 400, headers: corsHeaders });
    }

    console.log(`[generate-questionnaire-visual] Starting for ${questionnaireId}`);

    const { data: q } = await supabase
      .from("questionnaires")
      .select("id, title, description, theme, user_id")
      .eq("id", questionnaireId)
      .single();

    if (!q || q.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "问卷不存在或无权访问" }), { status: 404, headers: corsHeaders });
    }

    // 生成视觉 prompt
    const prompts = await generatePrompt(q);

    // 并行生成两张图片
    console.log("[generate-questionnaire-visual] Generating images in parallel...");

    async function genBg(): Promise<string> {
      const blob = await generateImage(prompts.bgPrompt, "柔和梦幻", "background");
      const url = await uploadAndGetUrl("questionnaire-assets", `${user.id}/${questionnaireId}/background.png`, blob);
      console.log("[generate-questionnaire-visual] Background uploaded:", url);
      return url;
    }

    async function genHero(): Promise<string> {
      const blob = await generateImage(prompts.heroPrompt, "精美插画", "hero");
      const url = await uploadAndGetUrl("questionnaire-assets", `${user.id}/${questionnaireId}/hero.png`, blob);
      console.log("[generate-questionnaire-visual] Hero uploaded:", url);
      return url;
    }

    const [bgResult, heroResult] = await Promise.allSettled([genBg(), genHero()]);

    let bgUrl: string | null = null;
    let heroUrl: string | null = null;

    if (bgResult.status === "fulfilled") {
      bgUrl = bgResult.value;
    } else {
      console.error("[generate-questionnaire-visual] Background failed:", bgResult.reason);
    }

    if (heroResult.status === "fulfilled") {
      heroUrl = heroResult.value;
    } else {
      console.error("[generate-questionnaire-visual] Hero failed:", heroResult.reason);
    }

    if (!bgUrl && !heroUrl) {
      throw new Error("两张图片均生成失败");
    }

    const themeConfig = {
      visualTheme: q.theme || "fantasy",
      colorPalette: {
        primary: "#6366F1",
        secondary: "#FFFFFF",
        accent: "#F8F9FF",
      },
    };

    // 检查是否已存在记录
    const { data: existing } = await supabase
      .from("questionnaire_visuals")
      .select("id")
      .eq("questionnaire_id", questionnaireId)
      .maybeSingle();

    if (existing) {
      const updates: Record<string, unknown> = { theme_config: themeConfig };
      if (bgUrl) updates.background_image_url = bgUrl;
      if (heroUrl) updates.hero_image_url = heroUrl;
      await supabase.from("questionnaire_visuals").update(updates).eq("id", existing.id);
    } else {
      await supabase.from("questionnaire_visuals").insert({
        questionnaire_id: questionnaireId,
        user_id: user.id,
        background_image_url: bgUrl,
        hero_image_url: heroUrl,
        visual_prompt: prompts.bgPrompt,
        theme_config: themeConfig,
      });
    }

    console.log("[generate-questionnaire-visual] Done");

    return new Response(JSON.stringify({
      backgroundImageUrl: bgUrl,
      heroImageUrl: heroUrl,
      themeConfig,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "服务器内部错误";
    console.error("[generate-questionnaire-visual] FATAL:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
