"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

type Option = {
  id: string;
  option_label: string;
  option_text: string;
  option_description: string;
  option_order: number;
  score_map: Record<string, number>;
};

type Question = {
  id: string;
  scene_label: string;
  question_text: string;
  helper_text: string;
  question_order: number;
  question_type: string;
  options: Option[];
};

type Questionnaire = {
  id: string;
  title: string;
  description: string;
  theme: string;
};

type VisualData = {
  background_image_url: string | null;
  hero_image_url: string | null;
};

const OPTION_COLORS = [
  { border: "border-primary/40", bg: "bg-primary/10", text: "text-pf-purple", letterBg: "bg-primary/15" },
  { border: "border-accent/40", bg: "bg-accent/10", text: "text-accent", letterBg: "bg-accent/15" },
  { border: "border-pf-pink/40", bg: "bg-pf-pink/10", text: "text-pf-pink", letterBg: "bg-pf-pink/15" },
  { border: "border-amber-500/40", bg: "bg-amber-500/10", text: "text-amber-400", letterBg: "bg-amber-500/15" },
];

const slideVariants = {
  enter: (direction: number) => ({ x: direction * 100, opacity: 0, scale: 0.96 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (direction: number) => ({ x: direction * -100, opacity: 0, scale: 0.96 }),
};

export default function PublicQuizPage() {
  const router = useRouter();
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [visual, setVisual] = useState<VisualData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState("");
  const [direction, setDirection] = useState(1);
  const [feedbackText, setFeedbackText] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    const slug = window.location.pathname.split("/").pop();
    if (!slug) return;
    loadQuestionnaire(slug);
  }, []);

  async function loadQuestionnaire(slug: string) {
    setLoading(true);
    const supabase = createClient();

    const { data: q } = await supabase
      .from("questionnaires")
      .select("id, title, description, theme")
      .eq("share_slug", slug)
      .eq("is_public", true)
      .single();

    if (!q) {
      setError("问卷不存在或已设为私密");
      setLoading(false);
      return;
    }
    setQuestionnaire(q);

    // Load visual
    const { data: vis } = await supabase
      .from("questionnaire_visuals")
      .select("background_image_url, hero_image_url")
      .eq("questionnaire_id", q.id)
      .maybeSingle();
    if (vis) setVisual(vis);

    // Load questions
    const { data: qs } = await supabase
      .from("questions")
      .select("id, scene_label, question_text, helper_text, question_order, question_type")
      .eq("questionnaire_id", q.id)
      .order("question_order", { ascending: true });

    if (!qs?.length) {
      setError("问卷没有题目");
      setLoading(false);
      return;
    }

    const questionsWithOptions = await Promise.all(
      qs.map(async (qu) => {
        const { data: opts } = await supabase
          .from("question_options")
          .select("id, option_label, option_text, option_description, option_order, score_map")
          .eq("question_id", qu.id)
          .order("option_order", { ascending: true });
        return { ...qu, options: opts || [] };
      })
    );

    setQuestions(questionsWithOptions);
    setLoading(false);
  }

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const allAnswered = questions.length > 0 && questions.every((q) => selectedAnswers[q.id]);
  const progress = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  function selectOption(questionId: string, optionId: string) {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    setFeedbackText("画像碎片 +1");
    setShowFeedback(true);
    setTimeout(() => setShowFeedback(false), 800);
    if (currentIndex < totalQuestions - 1) {
      setTimeout(() => {
        setDirection(1);
        setCurrentIndex((i) => Math.min(i + 1, totalQuestions - 1));
      }, 400);
    }
  }

  function goToQuestion(index: number) {
    const clamped = Math.max(0, Math.min(index, totalQuestions - 1));
    setDirection(clamped > currentIndex ? 1 : -1);
    setCurrentIndex(clamped);
  }

  const goToPrev = () => {
    if (currentIndex > 0) { setDirection(-1); setCurrentIndex((i) => i - 1); }
  };
  const goToNext = () => {
    if (currentIndex < totalQuestions - 1) { setDirection(1); setCurrentIndex((i) => i + 1); }
  };

  const handleSubmit = async () => {
    if (!allAnswered || !questionnaire) return;
    setSubmitting(true);
    setSubmitStep("正在提交你的答案...");

    try {
      const supabase = createClient();
      const answers = Object.entries(selectedAnswers).map(
        ([questionId, optionId]) => ({
          questionId,
          optionId,
        })
      );

      setSubmitStep("AI 正在分析你的人格画像...");
      const { data, error: fnErr } = await supabase.functions.invoke(
        "submit-public-response",
        {
          body: {
            questionnaireId: questionnaire.id,
            answers,
          },
        }
      );

      if (fnErr) throw new Error(fnErr.message || "提交失败");

      const shareSlug = data?.shareSlug;
      if (shareSlug) {
        setSubmitStep("分析完成！即将跳转...");
        setTimeout(() => {
          router.push(`/share/${shareSlug}`);
        }, 600);
      } else {
        throw new Error("未获取到结果链接");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "提交失败");
      setSubmitting(false);
    }
  };

  // --- Loading ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div key={i} className="w-3 h-3 rounded-full bg-primary"
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
          ))}
        </div>
      </div>
    );
  }

  // --- Error ---
  if (error && !submitting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="blob-card p-8 max-w-md text-center">
          <p className="text-muted-foreground mb-4">{error}</p>
          <Link href="/" className="btn-primary inline-flex">创建我的专属问卷</Link>
        </div>
      </div>
    );
  }

  // --- Submitting / Processing ---
  if (submitting) {
    const steps = [
      { key: "正在提交你的答案...", label: "保存答题数据" },
      { key: "AI 正在分析你的人格画像...", label: "AI 分析人格画像" },
      { key: "分析完成！即将跳转...", label: "AI 绘制专属视觉背景" },
      { key: "分析完成！即将跳转...", label: "即将进入你的专属页面" },
    ];
    const currentStepIdx = steps.findIndex(
      (s) => submitStep.includes(s.key) || submitStep === s.key
    );

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[100px] animate-orb" />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative text-center max-w-sm w-full"
        >
          <div className="flex gap-1.5 justify-center mb-8">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-3 h-3 rounded-full bg-primary"
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-8">
            {submitStep || "正在处理..."}
          </h2>
          <div className="space-y-3 text-left">
            {steps.map((s, i) => (
              <div
                key={s.label}
                className={`flex items-center gap-3 transition-all duration-500 ${
                  i <= currentStepIdx ? "opacity-100" : "opacity-30"
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    i < currentStepIdx
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : i === currentStepIdx
                        ? "bg-primary/20 text-pf-purple border border-primary/30"
                        : "glass text-muted-foreground border border-border"
                  }`}
                >
                  {i < currentStepIdx ? "✓" : i + 1}
                </span>
                <span className={`text-sm ${
                  i <= currentStepIdx ? "text-foreground" : "text-muted-foreground"
                }`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // --- Cover Screen ---
  if (!started && questionnaire) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-background">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-pf-indigo/12 blur-[120px]" />
        </div>
        {visual?.background_image_url && (
          <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${visual.background_image_url})` }} />
        )}

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative z-10 text-center max-w-lg">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="mb-8">
            {visual?.hero_image_url ? (
              <img src={visual.hero_image_url} alt="" className="w-48 h-48 mx-auto rounded-3xl shadow-2xl object-cover" />
            ) : (
              <div className="w-48 h-48 mx-auto blob-card flex items-center justify-center">
                <span className="text-4xl">🎯</span>
              </div>
            )}
          </motion.div>

          <h1 className="text-3xl sm:text-4xl font-black text-foreground mb-4">{questionnaire.title}</h1>
          <p className="text-foreground/60 text-lg mb-3">{questionnaire.description}</p>

          <div className="flex items-center justify-center gap-6 mb-8 text-foreground/40 text-sm">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {totalQuestions} 道题目
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              约 3 分钟
            </span>
          </div>

          <motion.button whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.03 }}
            onClick={() => setStarted(true)} className="btn-primary text-lg px-12 py-4">
            开始答题
          </motion.button>

          <p className="text-foreground/25 text-xs mt-6">由 PersonaFlow 用户分享</p>
        </motion.div>
      </div>
    );
  }

  // --- Quiz Screen ---
  return (
    <div className="min-h-screen flex flex-col relative bg-background overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[20%] left-[20%] w-[500px] h-[400px] rounded-full bg-pf-indigo/10 blur-[120px]" />
        <div className="absolute bottom-[20%] right-[20%] w-[400px] h-[350px] rounded-full bg-accent/8 blur-[100px]" />
      </div>
      {visual?.background_image_url && (
        <div className="absolute inset-0 bg-cover bg-center opacity-15" style={{ backgroundImage: `url(${visual.background_image_url})` }} />
      )}

      {/* Top Bar */}
      <div className="relative z-10 glass border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-sm sm:text-base font-semibold text-foreground">{questionnaire?.title}</h1>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">公开问卷 · 匿名答题</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalQuestions }).map((_, i) => (
                <button key={i} onClick={() => goToQuestion(i)}
                  className={`w-2 h-2 rounded-full transition-all ${i <= currentIndex ? "bg-accent progress-glow" : "glass"}`} />
              ))}
            </div>
            <span className="text-sm font-semibold text-accent tabular-nums">
              {String(currentIndex + 1).padStart(2, "0")} / {String(totalQuestions).padStart(2, "0")}
            </span>
          </div>
          <Link href="/" className="px-4 py-2 rounded-full text-xs text-muted-foreground hover:text-foreground glass border border-border transition">
            PersonaFlow
          </Link>
        </div>
        <div className="w-full h-[2px] glass">
          <motion.div className="h-full bg-gradient-to-r from-pf-purple via-pf-indigo to-pf-cyan"
            animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: "easeInOut" }} />
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-4 max-w-2xl mx-auto w-full">
        <AnimatePresence mode="wait" custom={direction}>
          {currentQuestion && (
            <motion.div key={currentQuestion.id} custom={direction} variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="w-full flex flex-col gap-5"
            >
              {/* Question Card */}
              <div className="blob-card p-6 sm:p-8 flex flex-col gap-4">
                {currentQuestion.scene_label && (
                  <div className="ai-badge w-fit text-xs">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                    </svg>
                    {currentQuestion.scene_label}
                  </div>
                )}
                <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-relaxed">
                  {currentQuestion.question_text}
                </h2>
                {currentQuestion.helper_text && (
                  <p className="text-sm text-muted-foreground">{currentQuestion.helper_text}</p>
                )}
              </div>

              {/* Option Cards */}
              <div className="flex flex-col gap-3">
                {currentQuestion.options.map((opt, idx) => {
                  const isSelected = selectedAnswers[currentQuestion.id] === opt.id;
                  const colors = OPTION_COLORS[idx % OPTION_COLORS.length];
                  return (
                    <motion.button key={opt.id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 + idx * 0.06 }}
                      whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}
                      onClick={() => selectOption(currentQuestion.id, opt.id)}
                      className={`w-full text-left flex items-center gap-4 p-4 sm:p-5 rounded-2xl border transition-all duration-200 ${
                        isSelected
                          ? `${colors.border} ${colors.bg} shadow-primary-glow scale-[1.01]`
                          : "border-border glass hover:glass hover:border-border"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${
                        isSelected ? `${colors.letterBg} ${colors.text}` : "glass text-muted-foreground"}`}>
                        <span className="text-sm font-bold">{opt.option_label || String.fromCharCode(65 + idx)}</span>
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-sm sm:text-base font-semibold text-foreground">{opt.option_text}</span>
                        {opt.option_description && (
                          <span className="text-xs text-muted-foreground truncate">{opt.option_description}</span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Feedback */}
              <AnimatePresence>
                {showFeedback && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    className="ai-bubble w-fit">
                    <span className="text-xs font-medium text-pf-purple">{feedbackText}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Nav */}
      <div className="relative z-10 glass border-t border-border">
        <div className="max-w-2xl mx-auto px-6 py-4 flex justify-between items-center">
          <button onClick={goToPrev} disabled={currentIndex === 0}
            className="px-4 py-2 text-muted-foreground hover:text-foreground transition disabled:opacity-30 text-sm font-medium">
            ← 上一题
          </button>
          <div className="flex gap-2 md:hidden">
            {questions.map((_, i) => (
              <button key={i} onClick={() => goToQuestion(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentIndex ? "bg-accent scale-125 progress-glow" :
                  selectedAnswers[questions[i]?.id] ? "bg-primary/40" : "glass[0.12]"}`} />
            ))}
          </div>
          {currentIndex === totalQuestions - 1 ? (
            <motion.button whileTap={{ scale: 0.95 }} onClick={handleSubmit}
              disabled={!allAnswered || submitting}
              className="btn-primary text-sm disabled:opacity-40">
              {submitting ? "提交中..." : "完成答题"}
            </motion.button>
          ) : (
            <button onClick={goToNext} disabled={currentIndex === totalQuestions - 1}
              className="px-4 py-2 text-muted-foreground hover:text-foreground transition disabled:opacity-30 text-sm font-medium">
              下一题 →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
