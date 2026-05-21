"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth-context";

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
  theme_config: Record<string, unknown>;
};

const OPTION_EMOJIS = ["🅐", "🅑", "🅒", "🅓"];

export default function QuestionnairePage() {
  const router = useRouter();
  const { user } = useAuth();
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

  useEffect(() => {
    const pathId = window.location.pathname.split("/").pop();
    if (!pathId) return;
    loadQuestionnaire(pathId);

    const timer = setInterval(() => {
      const supabase = createClient();
      supabase
        .from("questionnaire_visuals")
        .select("background_image_url, hero_image_url, theme_config")
        .eq("questionnaire_id", pathId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.background_image_url) setVisual(data);
        });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  async function loadQuestionnaire(id: string) {
    setLoading(true);
    const supabase = createClient();

    const { data: q } = await supabase
      .from("questionnaires")
      .select("id, title, description, theme")
      .eq("id", id)
      .single();

    if (!q) {
      setError("问卷不存在");
      setLoading(false);
      return;
    }
    setQuestionnaire(q);

    const { data: vis } = await supabase
      .from("questionnaire_visuals")
      .select("background_image_url, hero_image_url, theme_config")
      .eq("questionnaire_id", id)
      .maybeSingle();
    if (vis) setVisual(vis);

    const { data: qs } = await supabase
      .from("questions")
      .select("id, scene_label, question_text, helper_text, question_order, question_type")
      .eq("questionnaire_id", id)
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

  function selectOption(questionId: string, optionId: string) {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionId }));

    if (currentIndex < totalQuestions - 1) {
      setTimeout(() => {
        setCurrentIndex((i) => i + 1);
      }, 400);
    }
  }

  function goToQuestion(index: number) {
    setCurrentIndex(Math.max(0, Math.min(index, totalQuestions - 1)));
  }

  const goToPrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const goToNext = () => {
    if (currentIndex < totalQuestions - 1) setCurrentIndex((i) => i + 1);
  };

  const handleSubmit = async () => {
    if (!allAnswered || !questionnaire) return;
    setSubmitting(true);

    const supabase = createClient();

    try {
      const { data: response, error: respErr } = await supabase
        .from("responses")
        .insert({
          questionnaire_id: questionnaire.id,
          user_id: user!.id,
          status: "in_progress",
        })
        .select()
        .single();

      if (respErr || !response) throw new Error("创建答题记录失败");

      const answers = Object.entries(selectedAnswers).map(
        ([questionId, optionId]) => ({
          response_id: response.id,
          question_id: questionId,
          option_id: optionId,
        })
      );

      const { error: ansErr } = await supabase
        .from("response_answers")
        .insert(answers);
      if (ansErr) throw new Error("保存答案失败");

      setSubmitStep("正在分析你的回答...");
      const { data: personaData, error: personaErr } = await supabase.functions.invoke(
        "analyze-persona",
        { body: { responseId: response.id } }
      );
      if (personaErr || personaData?.error) {
        throw new Error(personaErr?.message || personaData?.error || "画像生成失败");
      }

      const prId = personaData.personaResultId;

      setSubmitStep("正在生成专属页面...");
      const { data: pageData, error: pageErr } = await supabase.functions.invoke(
        "generate-page",
        { body: { personaResultId: prId } }
      );
      if (pageErr || pageData?.error) {
        throw new Error(pageErr?.message || pageData?.error || "页面生成失败");
      }

      setSubmitStep("正在绘制专属背景...");
      const { error: visualErr } = await supabase.functions
        .invoke("generate-page-visual", { body: { personaResultId: prId } });
      if (visualErr) console.warn("Visual generation error (non-blocking):", visualErr);

      setSubmitStep("准备就绪！");
      router.push(`/result/${prId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  // --- Loading State ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-3 h-3 bg-primary"
              style={{ borderRadius: "60% 40% 55% 45%" }}
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      </div>
    );
  }

  // --- Error State ---
  if (error && !submitting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="blob-card p-8 max-w-md text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => router.push("/")} className="btn-primary">
            返回首页
          </button>
        </div>
      </div>
    );
  }

  // --- Submitting State ---
  if (submitting) {
    const steps = [
      { key: "正在分析你的回答...", label: "AI 分析你的答题偏好" },
      { key: "正在生成专属页面...", label: "生成专属页面配置" },
      { key: "正在绘制专属背景...", label: "AI 绘制专属视觉背景" },
      { key: "准备就绪！", label: "即将进入你的专属页面" },
    ];
    const currentStepIdx = steps.findIndex(
      (s) => submitStep.includes(s.key) || submitStep === s.key
    );

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/8 animate-blob"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative text-center max-w-sm w-full"
        >
          <div className="flex gap-2 justify-center mb-8">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-3 h-3 bg-primary"
                style={{ borderRadius: "60% 40% 55% 45%" }}
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-8">
            {submitStep || "正在分析你的回答..."}
          </h2>
          <div className="space-y-3 text-left">
            {steps.map((s, i) => (
              <div
                key={s.key}
                className={`flex items-center gap-3 transition-all duration-500 ${
                  i <= currentStepIdx ? "opacity-100" : "opacity-30"
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    i < currentStepIdx
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : i === currentStepIdx
                        ? "bg-primary/20 text-primary border border-primary/30"
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
        {/* Blob decor */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] right-[-20%] w-[600px] h-[600px] bg-primary/10 animate-blob" />
          <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] bg-accent/6 animate-blob" style={{ animationDelay: "-4s" }} />
        </div>

        {visual?.background_image_url && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{ backgroundImage: `url(${visual.background_image_url})` }}
          />
        )}

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
          className="relative z-10 text-center max-w-lg"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-8"
          >
            {visual?.hero_image_url ? (
              <img
                src={visual.hero_image_url}
                alt=""
                className="w-40 h-40 mx-auto rounded-[40% 60% 55% 45%] shadow-2xl object-cover"
              />
            ) : (
              <div className="w-40 h-40 mx-auto blob-card flex items-center justify-center">
                <span className="text-4xl">🎯</span>
              </div>
            )}
          </motion.div>

          <h1 className="text-3xl sm:text-4xl font-black text-foreground mb-4">
            {questionnaire.title}
          </h1>
          <p className="text-muted-foreground text-lg mb-3">
            {questionnaire.description}
          </p>

          <div className="flex items-center justify-center gap-6 mb-10 text-muted-foreground text-sm">
            <span>{totalQuestions} 道题目</span>
            <span>约 {Math.ceil(totalQuestions * 0.5)} 分钟</span>
          </div>

          <motion.button
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.03 }}
            onClick={() => setStarted(true)}
            className="btn-primary text-lg px-12 py-4"
          >
            开始答题
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // --- Quiz Screen ---
  return (
    <div className="min-h-screen flex flex-col relative bg-background overflow-hidden">
      {/* Background: organic blob */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] right-[-15%] w-[600px] h-[600px] bg-primary/6 animate-blob" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-accent/5 animate-blob" style={{ animationDelay: "-4s" }} />
      </div>

      {visual?.background_image_url && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-15"
          style={{ backgroundImage: `url(${visual.background_image_url})` }}
        />
      )}

      {/* Top bar */}
      <div className="relative z-10 glass border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-sm font-semibold text-foreground truncate max-w-[200px]">
            {questionnaire?.title}
          </h1>

          {/* Progress dots */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalQuestions }).map((_, i) => (
              <button
                key={i}
                onClick={() => goToQuestion(i)}
                className={`progress-dot ${
                  i === currentIndex ? "active" : selectedAnswers[questions[i]?.id] ? "done" : ""
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 rounded-full text-sm text-muted-foreground hover:text-foreground transition"
          >
            退出
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-2xl flex flex-col gap-6">
          <AnimatePresence mode="wait">
            {currentQuestion && (
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, y: 30, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.97 }}
                transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                className="flex flex-col gap-5"
              >
                {/* Question card */}
                <div className="blob-card p-8 sm:p-10 flex flex-col gap-4">
                  {currentQuestion.scene_label && (
                    <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
                      {currentQuestion.scene_label}
                    </span>
                  )}

                  <h2 className="text-2xl sm:text-[28px] font-bold text-foreground leading-relaxed">
                    {currentQuestion.question_text}
                  </h2>

                  {currentQuestion.helper_text && (
                    <p className="text-sm text-muted-foreground">
                      {currentQuestion.helper_text}
                    </p>
                  )}
                </div>

                {/* Options */}
                <div className="flex flex-col gap-3">
                  {currentQuestion.options.map((opt, idx) => {
                    const isSelected = selectedAnswers[currentQuestion.id] === opt.id;
                    return (
                      <motion.button
                        key={opt.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.06 * idx, duration: 0.35, ease: "easeOut" }}
                        onClick={() => selectOption(currentQuestion.id, opt.id)}
                        className={`option-blob text-left ${
                          isSelected ? "option-blob-selected" : ""
                        }`}
                      >
                        <span className="text-lg shrink-0">
                          {opt.option_label || OPTION_EMOJIS[idx] || String.fromCharCode(65 + idx)}
                        </span>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-sm sm:text-base font-semibold text-foreground">
                            {opt.option_text}
                          </span>
                          {opt.option_description && (
                            <span className="text-xs text-muted-foreground truncate">
                              {opt.option_description}
                            </span>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom nav */}
      <div className="relative z-10 border-t border-border">
        <div className="max-w-2xl mx-auto px-6 py-4 flex justify-between items-center">
          <button
            onClick={goToPrev}
            disabled={currentIndex === 0}
            className="px-4 py-2 text-muted-foreground hover:text-foreground transition disabled:opacity-30 text-sm font-medium"
          >
            ← 上一题
          </button>

          <span className="text-sm text-muted-foreground tabular-nums">
            {currentIndex + 1} / {totalQuestions}
          </span>

          {currentIndex === totalQuestions - 1 ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmit}
              disabled={!allAnswered || submitting}
              className="btn-primary text-sm disabled:opacity-40"
            >
              {submitting ? "提交中..." : "查看结果"}
            </motion.button>
          ) : (
            <button
              onClick={goToNext}
              disabled={currentIndex === totalQuestions - 1}
              className="px-4 py-2 text-muted-foreground hover:text-foreground transition disabled:opacity-30 text-sm font-medium"
            >
              下一题 →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
