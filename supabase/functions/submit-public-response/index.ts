import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
const DEEPSEEK_BASE = "https://api.deepseek.com/v1";
const DOUBAO_API_KEY = Deno.env.get("DOUBAO_API_KEY")!;
const DOUBAO_BASE = "https://ark.cn-beijing.volces.com/api/v3";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const PERSONA_SYSTEM_PROMPT = `你是一个专业的心理画像分析师。
请根据用户的答题数据生成一份结构化的用户画像。

要求：
1. 输出严格 JSON，不要输出 Markdown 代码块，不要有任何额外文字。
2. JSON 结构：{ "title": "画像标题", "summary": "总体描述（100-200字）", "tags": ["标签1","标签2",...], "dimensionScores": {"维度名": 分数}, "matchedResult": {"name": "匹配结果名称", "reason": "匹配理由"}, "suggestions": ["建议1","建议2"] }
3. tags 建议 4 到 6 个。
4. dimensionScores 分数范围为 0 到 100，根据用户答题的 scoreMap 累加值来估算百分比分数。
5. matchedResult.reason 需要 30-80 字的详细说明。
6. 画像应与问卷主题紧密关联，不要泛泛而谈。
7. 输出语言为中文。`;

const PAGE_SYSTEM_PROMPT = `你是一个专业的页面设计配置生成器。
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
3. style.primaryColor 必须是合法的 hex 颜色值。
4. sections 数量为 3 到 5 个，必须包含至少一个 tag-list 和一个 score-chart。
5. 每个 section 必须包含 type 字段。
6. 输出语言为中文。`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function extractJson(text: string): string {
  const cleaned = text.trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const objMatch = cleaned.match(/(\{[\s\S]*\})/);
  if (objMatch?.[1]) return objMatch[1].trim();
  return cleaned;
}

function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const VISUAL_PROMPT_SYSTEM = `你是一个专业的视觉设计 prompt 工程师。
根据用户画像结果，生成高质量的中文图像生成 prompt。

要求：
1. 输出严格 JSON：{"bgPrompt":"背景图prompt","heroPrompt":"主视觉图prompt","colorScheme":"配色主题名"}
2. bgPrompt：适合网页全屏背景的氛围图，有空间留白感，色调柔和
3. heroPrompt：页面顶部主视觉图，具有视觉冲击力和情绪表达
4. 风格应与画像气质匹配：温柔型→柔和暖色、理性型→冷色简约、热情型→活力暖色、幻想型→梦幻紫蓝
5. 不要出现具体 IP 角色名
6. 画面不包含文字`;

async function generateVisualPrompts(persona: { title: string; summary: string; tags: string[]; dimensionScores: Record<string, number>; matchedResult: { name: string; reason: string } }) {
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: VISUAL_PROMPT_SYSTEM },
        { role: "user", content: JSON.stringify(persona, null, 2) },
      ],
      temperature: 0.8, max_tokens: 1024,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek visual prompt 失败: ${res.status}`);
  const json = await res.json();
  return JSON.parse(json.choices[0].message.content) as { bgPrompt: string; heroPrompt: string; colorScheme: string };
}

async function generateImage(prompt: string, style: string, label: string, retries = 2): Promise<Blob> {
  const fullPrompt = `${prompt}。风格：${style}，高质量，精美细节`;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`[submit-public-response] Generating ${label} image (attempt ${attempt + 1})...`);
      const res = await fetch(`${DOUBAO_BASE}/images/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DOUBAO_API_KEY}` },
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
        const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(30000) });
        if (!imgRes.ok) throw new Error(`下载${label}失败: ${imgRes.status}`);
        return await imgRes.blob();
      }
      throw new Error(`${label}返回为空`);
    } catch (err) {
      lastErr = err;
      const msg = (err as Error).message || String(err);
      const isTimeout = msg.includes("timeout") || msg.includes("timed out") || msg.includes("ETIMEDOUT") || msg.includes("Connect");
      if (attempt < retries && isTimeout) {
        const delay = 2000 * Math.pow(2, attempt);
        console.warn(`[submit-public-response] ${label} retry ${attempt + 1} after ${delay}ms (${msg.slice(0, 100)})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function uploadAndGetUrl(bucket: string, path: string, blob: Blob): Promise<string> {
  const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, blob, { contentType: "image/png", upsert: true });
  if (uploadErr) throw new Error(`上传失败: ${uploadErr.message}`);
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
  return urlData.publicUrl;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { questionnaireId, answers } = body as {
      questionnaireId: string;
      answers: Array<{ questionId: string; optionId: string }>;
    };

    if (!questionnaireId || !answers?.length) {
      return new Response(JSON.stringify({ error: "缺少参数" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[submit-public-response] Starting for questionnaire ${questionnaireId}`);

    // 1. Verify questionnaire is public
    const { data: q, error: qErr } = await supabase
      .from("questionnaires")
      .select("id, title, description, theme, is_public")
      .eq("id", questionnaireId)
      .eq("is_public", true)
      .single();

    if (qErr || !q) {
      return new Response(JSON.stringify({ error: "问卷不存在或未公开" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Create anonymous response
    console.log("[submit-public-response] Creating response...");
    const { data: response, error: respErr } = await supabase
      .from("responses")
      .insert({
        questionnaire_id: questionnaireId,
        status: "completed",
      })
      .select()
      .single();

    if (respErr || !response) {
      throw new Error(`创建响应失败: ${respErr?.message}`);
    }

    // 3. Insert answers
    const answerRows = answers.map((a) => ({
      response_id: response.id,
      question_id: a.questionId,
      option_id: a.optionId,
    }));

    const { error: ansErr } = await supabase
      .from("response_answers")
      .insert(answerRows);

    if (ansErr) {
      throw new Error(`保存答案失败: ${ansErr.message}`);
    }

    console.log("[submit-public-response] Response + answers saved");

    // 4. Fetch full answer data for analysis
    const { data: fullAnswers, error: fetchErr } = await supabase
      .from("response_answers")
      .select(`
        question_id,
        option_id,
        questions!inner(question_text, question_order),
        question_options!inner(option_text, score_map)
      `)
      .eq("response_id", response.id)
      .order("created_at", { ascending: true });

    if (fetchErr || !fullAnswers?.length) {
      throw new Error("获取答题数据失败");
    }

    const aggregatedScores: Record<string, number> = {};
    const answerSummary: Array<{ question: string; answer: string; scores: Record<string, number> }> = [];

    for (const ans of fullAnswers) {
      const questionText = (ans.questions as unknown as { question_text: string }).question_text;
      const optionText = (ans.question_options as unknown as { option_text: string }).option_text;
      const scoreMap = (ans.question_options as unknown as { score_map: Record<string, number> }).score_map;

      answerSummary.push({ question: questionText, answer: optionText, scores: scoreMap });

      for (const [dim, val] of Object.entries(scoreMap)) {
        aggregatedScores[dim] = (aggregatedScores[dim] || 0) + val;
      }
    }

    // 5. Run persona analysis via DeepSeek
    console.log("[submit-public-response] Running persona analysis...");
    const personaInput = {
      questionnaireTitle: q.title,
      questionnaireTheme: q.theme ?? "",
      answerSummary,
      aggregatedScores,
    };

    let personaTitle = "";
    let personaSummary = "";
    let personaTags: string[] = [];
    let dimensionScores: Record<string, number> = {};
    let matchedResult: { name: string; reason: string } = { name: "", reason: "" };
    let suggestions: string[] = [];

    for (let attempt = 0; attempt < 2; attempt++) {
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
              { role: "system", content: PERSONA_SYSTEM_PROMPT },
              { role: "user", content: JSON.stringify(personaInput, null, 2) },
            ],
            temperature: 0.8 + attempt * 0.1,
            max_tokens: 2048,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`[submit-public-response] DeepSeek persona error (${res.status}):`, errText.slice(0, 300));
          if (attempt === 0) continue;
          throw new Error(`DeepSeek API 错误: ${res.status}`);
        }

        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (!content) {
          if (attempt === 0) continue;
          throw new Error("DeepSeek 返回内容为空");
        }

        const extracted = extractJson(content);
        const parsed = JSON.parse(extracted);

        personaTitle = parsed.title || "";
        personaSummary = parsed.summary || "";
        personaTags = parsed.tags || [];
        dimensionScores = parsed.dimensionScores || {};
        matchedResult = parsed.matchedResult || { name: "", reason: "" };
        suggestions = parsed.suggestions || [];
        break;
      } catch (aiErr) {
        console.error(`[submit-public-response] Persona attempt ${attempt + 1} failed:`, (aiErr as Error).message);
        if (attempt === 0) continue;
        throw aiErr;
      }
    }

    if (!personaTitle) {
      throw new Error("画像分析失败：未能生成有效结果");
    }

    // 6. Save persona result
    console.log("[submit-public-response] Saving persona result...");
    const { data: personaResult, error: personaErr } = await supabase
      .from("persona_results")
      .insert({
        response_id: response.id,
        user_id: null, // anonymous
        title: personaTitle,
        summary: personaSummary,
        tags: personaTags,
        dimension_scores: dimensionScores,
        matched_result: matchedResult,
        suggestions: suggestions,
      })
      .select()
      .single();

    if (personaErr || !personaResult) {
      throw new Error(`写入画像失败: ${personaErr?.message}`);
    }

    // 7. Generate page config via DeepSeek
    console.log("[submit-public-response] Generating page config...");
    const pageInput = {
      title: personaTitle,
      summary: personaSummary,
      tags: personaTags,
      dimensionScores,
      matchedResult,
      suggestions,
    };

    let pageConfig: Record<string, unknown> = {};

    for (let attempt = 0; attempt < 2; attempt++) {
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
              { role: "system", content: PAGE_SYSTEM_PROMPT },
              { role: "user", content: JSON.stringify(pageInput, null, 2) },
            ],
            temperature: 0.7 + attempt * 0.2,
            max_tokens: 4096,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`[submit-public-response] DeepSeek page error (${res.status}):`, errText.slice(0, 300));
          if (attempt === 0) continue;
          throw new Error(`DeepSeek API 错误: ${res.status}`);
        }

        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (!content) {
          if (attempt === 0) continue;
          throw new Error("DeepSeek 返回内容为空");
        }

        const extracted = extractJson(content);
        pageConfig = JSON.parse(extracted);
        break;
      } catch (aiErr) {
        console.error(`[submit-public-response] Page attempt ${attempt + 1} failed:`, (aiErr as Error).message);
        if (attempt === 0) continue;
        // If page generation fails, use a minimal config so persona is still accessible
        pageConfig = {
          style: { theme: q.theme || "fantasy", primaryColor: "#7C3AED", backgroundType: "gradient" },
          hero: { title: personaTitle, subtitle: "", description: personaSummary },
          sections: [
            { type: "tag-list", title: "人格标签", items: personaTags },
            { type: "score-chart", title: "维度评分", data: dimensionScores },
          ],
        };
      }
    }

    // 8. Generate unique share slug
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

    // 9. Save generated page
    console.log("[submit-public-response] Saving generated page...");
    const { data: page, error: pageErr } = await supabase
      .from("generated_pages")
      .insert({
        persona_result_id: personaResult.id,
        user_id: null, // anonymous
        page_config: pageConfig,
        share_slug: shareSlug,
        is_public: true,
      })
      .select()
      .single();

    if (pageErr || !page) {
      throw new Error(`写入页面失败: ${pageErr?.message}`);
    }

    // 10. Generate images (synchronous - wait for completion)
    console.log("[submit-public-response] Step 10: Generating visual prompts...");
    const personaForVisual = {
      title: personaTitle,
      summary: personaSummary,
      tags: personaTags,
      dimensionScores,
      matchedResult,
    };

    try {
      const prompts = await generateVisualPrompts(personaForVisual);
      console.log("[submit-public-response] Visual prompts ready, generating images in parallel...");

      async function genBg(): Promise<string> {
        const blob = await generateImage(prompts.bgPrompt, "柔和氛围", "bg");
        return await uploadAndGetUrl("page-assets", `anonymous/${personaResult.id}/background.png`, blob);
      }
      async function genHero(): Promise<string> {
        const blob = await generateImage(prompts.heroPrompt, "精美插画", "hero");
        return await uploadAndGetUrl("page-assets", `anonymous/${personaResult.id}/hero.png`, blob);
      }

      const [bgResult, heroResult] = await Promise.allSettled([genBg(), genHero()]);

      const updates: Record<string, string | null> = {};
      if (bgResult.status === "fulfilled") updates.background_image_url = bgResult.value;
      else console.error("[submit-public-response] bg failed:", bgResult.reason);
      if (heroResult.status === "fulfilled") updates.hero_image_url = heroResult.value;
      else console.error("[submit-public-response] hero failed:", heroResult.reason);

      if (Object.keys(updates).length > 0) {
        await supabase.from("generated_pages").update(updates).eq("id", page.id);
        console.log("[submit-public-response] Images saved");
      }
    } catch (visualErr) {
      console.error("[submit-public-response] Visual generation error (non-fatal):", (visualErr as Error).message);
    }

    console.log("[submit-public-response] Done. shareSlug:", shareSlug);

    return new Response(JSON.stringify({
      success: true,
      shareSlug,
      personaResultId: personaResult.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "服务器内部错误";
    console.error("[submit-public-response] FATAL:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
