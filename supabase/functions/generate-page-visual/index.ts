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
根据用户画像结果，生成高质量的中文图像生成 prompt。

要求：
1. 输出严格 JSON：{"bgPrompt":"背景图prompt","heroPrompt":"主视觉图prompt","colorScheme":"配色主题名"}
2. bgPrompt：适合网页全屏背景的氛围图，有空间留白感，色调柔和
3. heroPrompt：页面顶部主视觉图，具有视觉冲击力和情绪表达
4. 风格应与画像气质匹配：温柔型→柔和暖色、理性型→冷色简约、热情型→活力暖色、幻想型→梦幻紫蓝
5. 不要出现具体 IP 角色名
6. 画面不包含文字`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function generatePrompts(persona: {
  title: string; summary: string; tags: string[];
  dimensionScores: Record<string, number>; matchedResult: { name: string; reason: string };
}) {
  console.log("[generate-page-visual] Calling DeepSeek for prompts...");
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
        { role: "user", content: JSON.stringify(persona, null, 2) },
      ],
      temperature: 0.8,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek prompt 失败 (${res.status}): ${errText.slice(0, 300)}`);
  }
  const json = await res.json();
  const content = json.choices[0].message.content;
  console.log("[generate-page-visual] DeepSeek prompts generated successfully");
  return JSON.parse(content) as {
    bgPrompt: string; heroPrompt: string; colorScheme: string;
  };
}

async function generateImage(prompt: string, style: string, size = "2048x2048", retries = 2): Promise<Blob> {
  const fullPrompt = `${prompt}。风格：${style}，高质量，精美细节`;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`[generate-page-visual] Doubao image generation (${size}, attempt ${attempt + 1})...`);

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
          size,
          stream: false,
          watermark: true,
        }),
        signal: AbortSignal.timeout(90000),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`图像生成失败 (${res.status}): ${errText.slice(0, 500)}`);
      }

      const json = await res.json();
      const imgUrl = json.data?.[0]?.url;
      if (imgUrl) {
        console.log("[generate-page-visual] Downloading generated image...");
        const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(30000) });
        if (!imgRes.ok) throw new Error(`下载图片失败: ${imgRes.status}`);
        return await imgRes.blob();
      }

      const b64 = json.data?.[0]?.b64_json;
      if (b64) {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: "image/png" });
      }

      throw new Error(`图像生成返回为空。响应: ${JSON.stringify(json).slice(0, 300)}`);
    } catch (err) {
      lastErr = err;
      const msg = (err as Error).message || String(err);
      const isTimeout = msg.includes("timeout") || msg.includes("timed out") || msg.includes("ETIMEDOUT") || msg.includes("Connect");
      if (attempt < retries && isTimeout) {
        const delay = 2000 * Math.pow(2, attempt);
        console.warn(`[generate-page-visual] Retry ${attempt + 1} after ${delay}ms (${msg.slice(0, 100)})`);
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
    const personaResultId = body.personaResultId;
    if (!personaResultId) {
      return new Response(JSON.stringify({ error: "缺少 personaResultId" }), { status: 400, headers: corsHeaders });
    }

    console.log(`[generate-page-visual] Starting for persona ${personaResultId}, user ${user.id}`);

    // 获取画像数据
    const { data: persona } = await supabase
      .from("persona_results")
      .select("*")
      .eq("id", personaResultId)
      .single();

    if (!persona || persona.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "画像不存在或无权访问" }), { status: 404, headers: corsHeaders });
    }

    const personaData = {
      title: persona.title,
      summary: persona.summary,
      tags: persona.tags,
      dimensionScores: persona.dimension_scores,
      matchedResult: persona.matched_result,
    };

    // 生成视觉 prompt
    console.log("[generate-page-visual] Step 1: Generating prompts...");
    const prompts = await generatePrompts(personaData);

    // 并行生成并上传两张图片，每张独立 try-catch
    console.log("[generate-page-visual] Step 2: Generating images in parallel...");

    async function genBg(): Promise<string> {
      console.log("[generate-page-visual] Starting background image...");
      const blob = await generateImage(prompts.bgPrompt, "柔和氛围", "2048x2048");
      console.log("[generate-page-visual] Background image blob received, uploading...");
      const url = await uploadAndGetUrl("page-assets", `${user.id}/${personaResultId}/background.png`, blob);
      console.log("[generate-page-visual] Background uploaded:", url);
      return url;
    }

    async function genHero(): Promise<string> {
      console.log("[generate-page-visual] Starting hero image...");
      const blob = await generateImage(prompts.heroPrompt, "精美插画", "2048x2048");
      console.log("[generate-page-visual] Hero image blob received, uploading...");
      const url = await uploadAndGetUrl("page-assets", `${user.id}/${personaResultId}/hero.png`, blob);
      console.log("[generate-page-visual] Hero uploaded:", url);
      return url;
    }

    const [bgResult, heroResult] = await Promise.allSettled([genBg(), genHero()]);

    let bgUrl: string | null = null;
    let heroUrl: string | null = null;

    if (bgResult.status === "fulfilled") {
      bgUrl = bgResult.value;
    } else {
      console.error("[generate-page-visual] Background failed:", bgResult.reason);
    }

    if (heroResult.status === "fulfilled") {
      heroUrl = heroResult.value;
    } else {
      console.error("[generate-page-visual] Hero failed:", heroResult.reason);
    }

    if (!bgUrl && !heroUrl) {
      throw new Error("两张图片均生成失败");
    }

    // 更新 generated_pages 中的图像 URL
    console.log("[generate-page-visual] Step 3: Updating generated_pages...");
    const { data: existingPage } = await supabase
      .from("generated_pages")
      .select("id")
      .eq("persona_result_id", personaResultId)
      .maybeSingle();

    if (existingPage) {
      const updates: Record<string, string | null> = {};
      if (bgUrl) updates.background_image_url = bgUrl;
      if (heroUrl) updates.hero_image_url = heroUrl;

      const { error: updateErr } = await supabase
        .from("generated_pages")
        .update(updates)
        .eq("id", existingPage.id);

      if (updateErr) {
        console.error("[generate-page-visual] DB update failed:", updateErr);
      } else {
        console.log("[generate-page-visual] DB updated successfully");
      }
    } else {
      console.log("[generate-page-visual] No existing page found for persona_result_id:", personaResultId);
    }

    console.log("[generate-page-visual] Done. bg:", bgUrl ? "OK" : "null", "hero:", heroUrl ? "OK" : "null");

    return new Response(JSON.stringify({
      backgroundImageUrl: bgUrl,
      heroImageUrl: heroUrl,
      colorScheme: prompts.colorScheme,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "服务器内部错误";
    console.error("[generate-page-visual] FATAL:", message, err instanceof Error ? err.stack : "");
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
