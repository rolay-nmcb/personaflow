"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";

type MyQuestionnaire = {
  id: string;
  title: string;
  description: string;
  theme: string;
  created_at: string;
  topic_prompt: string;
  question_count: number;
  share_slug: string | null;
};

const EXAMPLE_TOPICS = [
  { text: "原神角色测试", emoji: "⚔️" },
  { text: "恋爱人格", emoji: "💕" },
  { text: "旅行风格", emoji: "✈️" },
  { text: "职场人格", emoji: "💼" },
  { text: "MBTI 风格", emoji: "🧠" },
];

const HIGHLIGHTS = [
  {
    emoji: "🎯",
    title: "AI 出题",
    desc: "输入主题，自动生成情景化问卷，每道题都围绕你的主题设计。",
  },
  {
    emoji: "🎨",
    title: "沉浸答题",
    desc: "AI 生成专属背景，有机卡片交互，每次选择都有微妙反馈。",
  },
  {
    emoji: "📊",
    title: "专属页面",
    desc: "AI 分析你的选择，生成独一无二的人格画像和专属分享页面。",
  },
];

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState("");
  const [depth, setDepth] = useState<"light" | "default" | "heavy">("default");
  const [error, setError] = useState("");
  const [myQuestionnaires, setMyQuestionnaires] = useState<MyQuestionnaire[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadMyQuestionnaires();
  }, [user]);

  async function loadMyQuestionnaires() {
    setLoadingMine(true);
    const supabase = createClient();
    const uid = user?.id;
    if (!uid) return;

    const { data, error: dbErr } = await supabase
      .from("questionnaires")
      .select("id, title, description, theme, created_at, project_id, share_slug")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(10);

    if (dbErr || !data) {
      setLoadingMine(false);
      return;
    }

    const projectIds = [...new Set(data.map((q: Record<string, unknown>) => q.project_id as string))];

    const { data: projects } = await supabase
      .from("questionnaire_projects")
      .select("id, topic_prompt")
      .in("id", projectIds);

    const projectMap = new Map<string, string>();
    if (projects) {
      for (const p of projects as Array<{ id: string; topic_prompt: string }>) {
        projectMap.set(p.id, p.topic_prompt);
      }
    }

    const enriched = await Promise.all(
      data.map(async (q: Record<string, unknown>) => {
        const { count } = await supabase
          .from("questions")
          .select("*", { count: "exact", head: true })
          .eq("questionnaire_id", q.id as string);
        return {
          id: q.id as string,
          title: q.title as string,
          description: (q.description as string) || "",
          theme: (q.theme as string) || "",
          created_at: q.created_at as string,
          topic_prompt: projectMap.get(q.project_id as string) || "",
          question_count: count || 0,
          share_slug: (q.share_slug as string) || null,
        } as MyQuestionnaire;
      })
    );
    setMyQuestionnaires(enriched);
    setLoadingMine(false);
  }

  async function handleShareQuestionnaire(q: MyQuestionnaire, e: React.MouseEvent) {
    e.stopPropagation();
    const supabase = createClient();

    let slug = q.share_slug;
    if (!slug) {
      slug = Array.from({ length: 8 }, () =>
        "abcdefghijklmnopqrstuvwxyz0123456789".charAt(Math.floor(Math.random() * 36))
      ).join("");

      const { error: updateErr } = await supabase
        .from("questionnaires")
        .update({ share_slug: slug, is_public: true })
        .eq("id", q.id);

      if (updateErr) {
        console.error("Failed to generate share link:", updateErr);
        return;
      }

      setMyQuestionnaires((prev) =>
        prev.map((item) =>
          item.id === q.id ? { ...item, share_slug: slug } : item
        )
      );
    }

    const url = `${window.location.origin}/quiz/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedShareId(q.id);
    setTimeout(() => setCopiedShareId(null), 2000);
  }

  const handleGenerate = async (input: string) => {
    const prompt = input || topic.trim();
    if (!prompt) {
      setError("请输入你想要探索的主题");
      return;
    }
    if (!user) {
      router.push("/login");
      return;
    }

    setError("");
    setGenerating(true);
    try {
      const supabase = createClient();

      setGenStep("AI 正在设计你的专属问卷...");
      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-questionnaire",
        { body: { topicPrompt: prompt, depth } }
      );
      if (fnError || data?.error) {
        throw new Error(fnError?.message || data?.error || "生成失败");
      }

      const qId = data.questionnaireId;

      setGenStep("AI 正在绘制沉浸式背景...");
      const { error: visErr } = await supabase.functions
        .invoke("generate-questionnaire-visual", {
          body: { questionnaireId: qId },
        });
      if (visErr) console.warn("Questionnaire visual error (non-blocking):", visErr);

      setGenStep("准备就绪！");
      router.push(`/questionnaire/${qId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "问卷生成失败，请重试");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background: single large organic blob */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-primary/12 animate-blob"
        />
        <div
          className="absolute bottom-[-15%] left-[-5%] w-[500px] h-[500px] bg-pf-cyan/8 animate-blob"
          style={{ animationDelay: "-3s" }}
        />
        <div className="absolute inset-0 bg-dots opacity-30" />
      </div>

      <Navbar />

      <main className="relative z-10 pt-[72px]">
        {/* ===== HERO ===== */}
        <section className="section-padding pt-20 pb-12 lg:pt-28 lg:pb-16">
          <div className="max-w-2xl mx-auto flex flex-col items-center text-center gap-8">
            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
              className="text-4xl sm:text-5xl lg:text-[56px] font-black text-foreground leading-[1.12] tracking-tight"
            >
              一句话，生成你的
              <br />
              <span className="text-primary">专属人格画像</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="text-base sm:text-lg text-muted-foreground max-w-md leading-relaxed"
            >
              输入任意主题，AI 生成沉浸式问卷，分析你的选择，
              创建独一无二的专属页面。
            </motion.p>

            {/* Prompt Box */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="w-full blob-card p-6 flex flex-col gap-4"
            >
              {/* Input Row */}
              <div className="flex items-center gap-3">
                <input
                  value={topic}
                  onChange={(e) => {
                    setTopic(e.target.value);
                    setError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerate("")}
                  placeholder={
                    user
                      ? "例如：我想知道我是原神里的哪个角色..."
                      : "登录后输入你想要探索的主题..."
                  }
                  className="flex-1 bg-transparent text-foreground outline-none text-base placeholder:text-muted-foreground"
                  disabled={generating}
                />
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleGenerate("")}
                  disabled={generating || !user}
                  className="shrink-0 px-6 py-3.5 gradient-cta text-foreground font-semibold rounded-full text-sm transition disabled:opacity-50 whitespace-nowrap"
                >
                  {generating ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      生成中
                    </span>
                  ) : (
                    "生成问卷"
                  )}
                </motion.button>
              </div>

              {/* Depth Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">题目数量</span>
                {([
                  { value: "light", label: "轻量", desc: "4~5题" },
                  { value: "default", label: "标准", desc: "6~8题" },
                  { value: "heavy", label: "深度", desc: "10~15题" },
                ] as const).map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDepth(d.value)}
                    disabled={generating}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      depth === d.value
                        ? "chip-purple"
                        : "text-muted-foreground hover:text-secondary-foreground"
                    }`}
                  >
                    {d.label} · {d.desc}
                  </button>
                ))}
              </div>

              {/* Example Chips */}
              <div className="flex flex-wrap gap-2.5">
                {EXAMPLE_TOPICS.map((t) => (
                  <motion.button
                    key={t.text}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleGenerate(`${t.emoji} ${t.text}`)}
                    disabled={generating}
                    className="chip"
                  >
                    {t.emoji} {t.text}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {!user && (
              <p className="text-center text-muted-foreground text-sm">
                登录后即可生成你的第一份人格问卷
              </p>
            )}

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-red-400 text-sm text-center bg-red-500/10 rounded-xl py-3 px-4 border border-red-500/20"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* ===== GENERATING STATE ===== */}
        {generating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="section-padding pb-16"
          >
            <div className="max-w-sm mx-auto text-center">
              <div className="flex gap-2 justify-center mb-6">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-3 h-3 rounded-full bg-primary"
                    style={{ borderRadius: "60% 40% 55% 45%" }}
                    animate={{ y: [0, -12, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-6">
                {genStep || "准备中..."}
              </h3>
              <div className="space-y-3 text-left">
                {[
                  "AI 生成问卷题目",
                  "AI 绘制沉浸式背景图",
                  "进入答题空间",
                ].map((label, i) => {
                  const stages = ["设计你的专属问卷", "绘制沉浸式背景", "准备就绪"];
                  const activeIdx = stages.findIndex((s) => genStep.includes(s));
                  return (
                    <div
                      key={label}
                      className={`flex items-center gap-3 transition-all duration-500 ${
                        i <= activeIdx ? "opacity-100" : "opacity-30"
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          i < activeIdx
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : i === activeIdx
                              ? "bg-primary/20 text-primary border border-primary/30"
                              : "glass text-muted-foreground border border-border"
                        }`}
                      >
                        {i < activeIdx ? "✓" : i + 1}
                      </span>
                      <span className={`text-sm ${
                        i <= activeIdx ? "text-foreground" : "text-muted-foreground"
                      }`}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ===== MY QUESTIONNAIRES ===== */}
        {user && myQuestionnaires.length > 0 && !generating && (
          <section className="section-padding py-8 lg:py-12">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground tracking-widest uppercase">
                    你的问卷
                  </span>
                  <span className="chip-purple text-xs">{myQuestionnaires.length}</span>
                </div>
                <button
                  onClick={loadMyQuestionnaires}
                  className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1"
                >
                  <svg className={`w-3.5 h-3.5 ${loadingMine ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                  刷新
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myQuestionnaires.map((q, i) => (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                    className="blob-card p-5 flex flex-col gap-3 cursor-pointer group"
                    onClick={() => router.push(`/questionnaire/${q.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-black text-muted-foreground/30 tabular-nums">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 flex-1">
                          {q.title}
                        </h3>
                      </div>
                      <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full glass text-muted-foreground border border-border">
                        {q.question_count}题
                      </span>
                    </div>

                    {q.topic_prompt && (
                      <p className="text-xs text-muted-foreground truncate pl-9">
                        {q.topic_prompt}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-border pl-9">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(q.created_at).toLocaleDateString("zh-CN", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleShareQuestionnaire(q, e)}
                          className={`text-xs flex items-center gap-1 px-2 py-1 rounded-full transition-all ${
                            copiedShareId === q.id
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                              : "text-muted-foreground hover:text-foreground hover:glass"
                          }`}
                          title="复制分享链接"
                        >
                          {copiedShareId === q.id ? (
                            <>
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                              已复制
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                              </svg>
                              分享
                            </>
                          )}
                        </button>
                        <span className="text-xs font-medium text-primary group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                          答题
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ===== HIGHLIGHTS ===== */}
        {!generating && (
          <section className="section-padding py-12 lg:py-16">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-10">
                <p className="text-3xl sm:text-4xl font-black text-foreground">
                  不只是问卷
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {HIGHLIGHTS.map((h, i) => (
                  <motion.div
                    key={h.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                    className="blob-card-alt p-7 flex flex-col items-center text-center gap-3"
                  >
                    <span className="text-3xl">{h.emoji}</span>
                    <h3 className="text-base font-bold text-foreground">{h.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{h.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ===== FOOTER CTA ===== */}
        {!generating && (
          <section className="section-padding py-16 lg:py-20">
            <div className="max-w-lg mx-auto text-center flex flex-col items-center gap-6">
              <p className="text-2xl sm:text-3xl font-black text-foreground">
                准备好了吗？
              </p>
              <p className="text-muted-foreground">
                输入主题，30 秒获得专属人格画像
              </p>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  if (!user) router.push("/register");
                  else window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="btn-primary text-lg px-10 py-4"
              >
                {user ? "开始生成" : "免费注册体验"}
              </motion.button>
              <p className="text-xs text-muted-foreground">
                无需注册即可体验 · 完全免费
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
