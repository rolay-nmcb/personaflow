import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
const DEEPSEEK_BASE = "https://api.deepseek.com/v1";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SYSTEM_PROMPT = `你是一个专业的互动问卷产品设计师。
用户会输入一个主题，你必须严格围绕这个主题来设计整份问卷。

核心原则：
- 问卷的 title、description、theme、所有题目和选项，都必须直接关联用户输入的主题
- 如果用户说"我想知道我是原神里的哪个角色"，你就必须生成关于原神角色气质的测试题
- 如果用户说"我想知道我适合什么旅行方式"，你就必须生成关于旅行偏好的测试题
- 绝不能偏离主题，不能生成与用户输入无关的问卷

格式要求：
1. 输出严格 JSON，不要输出 Markdown 代码块，不要有任何额外文字。
2. 必须严格使用以下 JSON 结构，字段名必须完全一致（区分大小写）：

{
  "title": "问卷标题",
  "description": "一两句简要介绍",
  "theme": "english-slug",
  "questions": [
    {
      "questionText": "题目文字？",
      "options": [
        { "text": "选项A", "scoreMap": { "维度1": 3, "维度2": 1 } },
        { "text": "选项B", "scoreMap": { "维度1": 1, "维度2": 5 } },
        { "text": "选项C", "scoreMap": { "维度1": 5, "维度2": 2 } },
        { "text": "选项D", "scoreMap": { "维度1": 2, "维度2": 4 } }
      ]
    }
  ]
}

特别注意：
- 字段名是 questionText（驼峰命名），不是 question_text
- 字段名是 scoreMap（驼峰命名），不是 score_map
- 字段名是 options（不是 choices 或 answers）
- title、description、theme 都是字符串，不是数组
3. title 必须体现用户输入的主题关键词。
4. theme 用英文 slug 概括主题（如 genshin-character、travel-style、love-personality）。
5. questions 数量必须为 __QUESTION_MIN__ 到 __QUESTION_MAX__ 道。
6. 每道题必须有恰好 4 个 options。
7. scoreMap 使用中文人格/偏好维度作为 key，value 为 1 到 5 的整数。
   - 维度名应与主题相关，如原神主题用"勇气""智慧""温柔""冒险精神"等
8. 输出语言为中文。
9. 不要生成违法、色情、暴力、歧视内容。`;

interface QuestionOption {
  text: string;
  scoreMap: Record<string, number>;
}

interface Question {
  questionText: string;
  options: QuestionOption[];
}

interface Questionnaire {
  title: string;
  description: string;
  theme: string;
  questions: Question[];
}

function extractJson(text: string): string {
  const cleaned = text.trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const objMatch = cleaned.match(/(\{[\s\S]*\})/);
  if (objMatch?.[1]) return objMatch[1].trim();
  return cleaned;
}

function validateQuestionnaire(data: unknown, qMin: number, qMax: number): Questionnaire {
  if (!data || typeof data !== "object") throw new Error("返回数据不是对象");
  const q = data as Record<string, unknown>;

  if (typeof q.title !== "string" || !q.title.trim()) throw new Error("缺少 title");
  if (typeof q.description !== "string") throw new Error("缺少 description");
  if (typeof q.theme !== "string") throw new Error("缺少 theme");

  if (!Array.isArray(q.questions)) throw new Error("questions 必须是数组");
  if (q.questions.length < qMin || q.questions.length > qMax) {
    throw new Error(`题目数量必须是 ${qMin}-${qMax}，实际为 ${q.questions.length}`);
  }

  for (let i = 0; i < q.questions.length; i++) {
    const qu = q.questions[i] as Record<string, unknown>;
    if (typeof qu.questionText !== "string" || !qu.questionText.trim()) {
      throw new Error(`第 ${i + 1} 题缺少 questionText`);
    }
    if (!Array.isArray(qu.options)) throw new Error(`第 ${i + 1} 题 options 必须是数组`);
    if (qu.options.length !== 4) {
      throw new Error(`第 ${i + 1} 题选项数必须为 4，实际为 ${qu.options.length}`);
    }
    for (let j = 0; j < (qu.options as unknown[]).length; j++) {
      const opt = (qu.options as unknown[])[j] as Record<string, unknown>;
      if (typeof opt.text !== "string" || !opt.text.trim()) {
        throw new Error(`第 ${i + 1} 题第 ${j + 1} 个选项缺少 text`);
      }
      if (!opt.scoreMap || typeof opt.scoreMap !== "object" || Object.keys(opt.scoreMap as object).length === 0) {
        throw new Error(`第 ${i + 1} 题第 ${j + 1} 个选项 scoreMap 不能为空`);
      }
      for (const [dim, val] of Object.entries(opt.scoreMap as Record<string, unknown>)) {
        if (typeof val !== "number" || val < 1 || val > 5 || !Number.isInteger(val)) {
          throw new Error(`第 ${i + 1} 题第 ${j + 1} 个选项 scoreMap.${dim} 必须是 1-5 的整数`);
        }
      }
    }
  }
  return q as unknown as Questionnaire;
}

async function callDeepSeek(userPrompt: string, qMin: number, qMax: number): Promise<Questionnaire> {
  const sysPrompt = SYSTEM_PROMPT.replace("__QUESTION_MIN__", String(qMin)).replace("__QUESTION_MAX__", String(qMax));
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: `用户输入的主题是：「${userPrompt}」。请严格围绕这个主题生成问卷。问卷标题、描述、所有题目和选项都必须与这个主题直接相关。` },
      ],
      temperature: 0.8,
      max_tokens: 4096,
      response_format: { type: "json_object" },
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

  try {
    return validateQuestionnaire(parsed, qMin, qMax);
  } catch (validationErr) {
    console.error("验证失败，原始 AI 返回内容:", content.slice(0, 500));
    throw validationErr;
  }
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
    const topicPrompt = body.topicPrompt;
    if (!topicPrompt || typeof topicPrompt !== "string" || !topicPrompt.trim()) {
      return new Response(JSON.stringify({ error: "请输入主题内容" }), { status: 400, headers: corsHeaders });
    }

    const depth = (body.depth === "light" || body.depth === "heavy" ? body.depth : "default") as "light" | "default" | "heavy";
    const qConfig = { light: { min: 4, max: 5 }, default: { min: 6, max: 8 }, heavy: { min: 10, max: 15 } }[depth];
    console.log(`[generate-questionnaire] depth=${depth}, questions=${qConfig.min}-${qConfig.max}`);

    // 创建项目
    const { data: project, error: projectErr } = await supabase
      .from("questionnaire_projects")
      .insert({ user_id: user.id, topic_prompt: topicPrompt.trim(), status: "generating" })
      .select()
      .single();

    if (projectErr || !project) {
      throw new Error(`创建项目失败: ${projectErr?.message}`);
    }

    // 调用 AI
    let questionnaire: Questionnaire;
    try {
      questionnaire = await callDeepSeek(topicPrompt.trim(), qConfig.min, qConfig.max);
    } catch (aiErr: unknown) {
      console.error("第一次生成失败，重试中...", (aiErr as Error).message);
      questionnaire = await callDeepSeek(topicPrompt.trim(), qConfig.min, qConfig.max);
    }

    // 写入问卷
    const { data: qData, error: qErr } = await supabase
      .from("questionnaires")
      .insert({
        project_id: project.id,
        user_id: user.id,
        title: questionnaire.title,
        description: questionnaire.description,
        theme: questionnaire.theme,
      })
      .select()
      .single();

    if (qErr || !qData) throw new Error(`创建问卷失败: ${qErr?.message}`);

    // 写入题目和选项
    for (let i = 0; i < questionnaire.questions.length; i++) {
      const qu = questionnaire.questions[i];
      const { data: question, error: questionErr } = await supabase
        .from("questions")
        .insert({
          questionnaire_id: qData.id,
          question_text: qu.questionText,
          question_order: i + 1,
          question_type: "single_choice",
        })
        .select()
        .single();

      if (questionErr || !question) throw new Error(`创建题目失败: ${questionErr?.message}`);

      for (let j = 0; j < qu.options.length; j++) {
        const opt = qu.options[j];
        const { error: optErr } = await supabase
          .from("question_options")
          .insert({
            question_id: question.id,
            option_text: opt.text,
            option_order: j + 1,
            score_map: opt.scoreMap,
          });

        if (optErr) throw new Error(`创建选项失败: ${optErr.message}`);
      }
    }

    // 更新项目状态
    await supabase
      .from("questionnaire_projects")
      .update({ status: "published", updated_at: new Date().toISOString() })
      .eq("id", project.id);

    return new Response(JSON.stringify({
      projectId: project.id,
      questionnaireId: qData.id,
      title: questionnaire.title,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "服务器内部错误";
    console.error("generate-questionnaire error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
