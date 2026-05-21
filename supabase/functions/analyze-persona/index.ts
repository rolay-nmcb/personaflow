import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
const DEEPSEEK_BASE = "https://api.deepseek.com/v1";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SYSTEM_PROMPT = `你是一个专业的心理画像分析师。
请根据用户的答题数据生成一份结构化的用户画像。

要求：
1. 输出严格 JSON，不要输出 Markdown 代码块，不要有任何额外文字。
2. JSON 结构：{ "title": "画像标题", "summary": "总体描述（100-200字）", "tags": ["标签1","标签2",...], "dimensionScores": {"维度名": 分数}, "matchedResult": {"name": "匹配结果名称", "reason": "匹配理由"}, "suggestions": ["建议1","建议2"] }
3. tags 建议 4 到 6 个。
4. dimensionScores 分数范围为 0 到 100，根据用户答题的 scoreMap 累加值来估算百分比分数。
5. matchedResult.reason 需要 30-80 字的详细说明。
6. 画像应与问卷主题紧密关联，不要泛泛而谈。
7. 输出语言为中文。`;

interface PersonaResult {
  title: string;
  summary: string;
  tags: string[];
  dimensionScores: Record<string, number>;
  matchedResult: { name: string; reason: string };
  suggestions: string[];
}

function extractJson(text: string): string {
  const cleaned = text.trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const objMatch = cleaned.match(/(\{[\s\S]*\})/);
  if (objMatch?.[1]) return objMatch[1].trim();
  return cleaned;
}

function validatePersona(data: unknown): PersonaResult {
  if (!data || typeof data !== "object") throw new Error("返回数据不是对象");
  const p = data as Record<string, unknown>;

  if (typeof p.title !== "string" || !p.title.trim()) throw new Error("缺少 title");
  if (typeof p.summary !== "string" || p.summary.length < 20) throw new Error("summary 过短");
  if (!Array.isArray(p.tags) || p.tags.length < 3) throw new Error("tags 至少需要 3 个");
  if (!p.dimensionScores || typeof p.dimensionScores !== "object") throw new Error("缺少 dimensionScores");
  if (!p.matchedResult || typeof p.matchedResult !== "object") throw new Error("缺少 matchedResult");
  const mr = p.matchedResult as Record<string, unknown>;
  if (typeof mr.name !== "string" || !mr.name.trim()) throw new Error("matchedResult.name 不能为空");
  if (typeof mr.reason !== "string" || mr.reason.length < 10) throw new Error("matchedResult.reason 过短");
  if (!Array.isArray(p.suggestions)) throw new Error("suggestions 必须是数组");

  for (const [dim, val] of Object.entries(p.dimensionScores as Record<string, unknown>)) {
    if (typeof val !== "number" || val < 0 || val > 100) {
      throw new Error(`dimensionScores.${dim} 必须是 0-100 的数字`);
    }
  }

  return p as unknown as PersonaResult;
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
    const responseId = body.responseId;
    if (!responseId || typeof responseId !== "string") {
      return new Response(JSON.stringify({ error: "缺少 responseId" }), { status: 400, headers: corsHeaders });
    }

    // 查询答题记录
    const { data: response, error: respErr } = await supabase
      .from("responses")
      .select("id, questionnaire_id, user_id, status")
      .eq("id", responseId)
      .single();

    if (respErr || !response) {
      return new Response(JSON.stringify({ error: "答题记录不存在" }), { status: 404, headers: corsHeaders });
    }
    if (response.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "无权访问此答题记录" }), { status: 403, headers: corsHeaders });
    }

    // 查询问卷
    const { data: questionnaire } = await supabase
      .from("questionnaires")
      .select("title, description, theme")
      .eq("id", response.questionnaire_id)
      .single();

    // 查询所有答案及其选项的 scoreMap
    const { data: answers, error: ansErr } = await supabase
      .from("response_answers")
      .select(`
        question_id,
        option_id,
        questions!inner(question_text, question_order),
        question_options!inner(option_text, score_map)
      `)
      .eq("response_id", responseId)
      .order("created_at", { ascending: true });

    if (ansErr || !answers?.length) {
      return new Response(JSON.stringify({ error: "未找到答题数据" }), { status: 400, headers: corsHeaders });
    }

    // 聚合分数
    const aggregatedScores: Record<string, number> = {};
    const answerSummary: Array<{ question: string; answer: string; scores: Record<string, number> }> = [];

    for (const ans of answers) {
      const questionText = (ans.questions as unknown as { question_text: string }).question_text;
      const optionText = (ans.question_options as unknown as { option_text: string }).option_text;
      const scoreMap = (ans.question_options as unknown as { score_map: Record<string, number> }).score_map;

      answerSummary.push({ question: questionText, answer: optionText, scores: scoreMap });

      for (const [dim, val] of Object.entries(scoreMap)) {
        aggregatedScores[dim] = (aggregatedScores[dim] || 0) + val;
      }
    }

    // 调用 AI 生成画像
    const aiInput = {
      questionnaireTitle: questionnaire?.title ?? "",
      questionnaireTheme: questionnaire?.theme ?? "",
      answerSummary,
      aggregatedScores,
    };

    const userPrompt = JSON.stringify(aiInput, null, 2);

    let persona: PersonaResult;
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
          temperature: 0.8,
          max_tokens: 2048,
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

      persona = validatePersona(parsed);
    } catch (aiErr: unknown) {
      console.error("第一次画像生成失败，重试中...", (aiErr as Error).message);
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
          max_tokens: 2048,
        }),
      });
      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      const extracted = extractJson(content);
      persona = validatePersona(JSON.parse(extracted));
    }

    // 写入画像结果
    const { data: personaResult, error: insertErr } = await supabase
      .from("persona_results")
      .insert({
        response_id: responseId,
        user_id: user.id,
        title: persona.title,
        summary: persona.summary,
        tags: persona.tags,
        dimension_scores: persona.dimensionScores,
        matched_result: persona.matchedResult,
        suggestions: persona.suggestions,
      })
      .select()
      .single();

    if (insertErr || !personaResult) {
      throw new Error(`写入画像失败: ${insertErr?.message}`);
    }

    // 更新答题状态
    await supabase
      .from("responses")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", responseId);

    return new Response(JSON.stringify({
      personaResultId: personaResult.id,
      title: persona.title,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "服务器内部错误";
    console.error("analyze-persona error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
