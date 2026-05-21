"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

type PersonaResult = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  dimension_scores: Record<string, number>;
  matched_result: { name: string; reason: string } | null;
  suggestions: string[];
};

type PageData = {
  id: string;
  share_slug: string;
  background_image_url: string | null;
  hero_image_url: string | null;
};

const DIM_COLORS = ["#7C3AED", "#22D3EE", "#F0ABFC", "#F59E0B", "#EC4899"];
const DIM_BG = ["bg-primary/10", "bg-accent/10", "bg-pf-pink/10", "bg-amber-500/10", "bg-pink-500/10"];

export default function ResultPage() {
  const router = useRouter();
  const [persona, setPersona] = useState<PersonaResult | null>(null);
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const pathId = window.location.pathname.split("/").pop();
    if (!pathId) return;

    const supabase = createClient();

    async function load() {
      const { data: p } = await supabase
        .from("persona_results")
        .select("*")
        .eq("id", pathId)
        .single();
      if (p) setPersona(p);

      const { data: gp } = await supabase
        .from("generated_pages")
        .select("id, share_slug, background_image_url, hero_image_url")
        .eq("persona_result_id", pathId)
        .maybeSingle();
      if (gp) setPage(gp);

      setLoading(false);
    }

    load();

    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleCopyLink = () => {
    if (!page?.share_slug) return;
    const url = `${window.location.origin}/share/${page.share_slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleViewPage = () => {
    if (page) router.push(`/page/${page.id}`);
  };

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

  if (!persona) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="blob-card p-8 max-w-md text-center">
          <p className="text-muted-foreground mb-4">画像结果不存在</p>
          <button onClick={() => router.push("/")} className="btn-primary">
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const bgImg = page?.background_image_url;
  const scoreEntries = Object.entries(persona.dimension_scores || {});
  const tags = persona.tags || [];
  const suggestions = persona.suggestions || [];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background: single blob */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[50%] -translate-x-1/2 w-[700px] h-[700px] bg-primary/6 animate-blob" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-accent/4 animate-blob" style={{ animationDelay: "-4s" }} />
      </div>

      {bgImg && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-12"
          style={{ backgroundImage: `url(${bgImg})` }}
        />
      )}

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        {/* Back nav */}
        <button
          onClick={() => router.push("/")}
          className="text-sm text-muted-foreground hover:text-foreground transition mb-12"
        >
          ← 返回首页
        </button>

        {/* ===== HERO ===== */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl sm:text-6xl font-black text-foreground mb-6 leading-[1.1]">
            {persona.title}
          </h1>
          <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
            {persona.summary}
          </p>
        </motion.div>

        {/* ===== TAG CLOUD ===== */}
        {tags.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex flex-wrap justify-center gap-3 mb-16"
          >
            {tags.map((tag, i) => (
              <motion.span
                key={tag}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.06, type: "spring", stiffness: 200 }}
                className="chip px-4 py-2 text-sm font-medium"
                style={{ transform: `rotate(${(i - 1) * 1.5}deg)` }}
              >
                {tag}
              </motion.span>
            ))}
          </motion.div>
        )}

        {/* ===== 01 PERSONA SUMMARY ===== */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mb-12"
        >
          <span className="text-5xl font-black text-muted-foreground/15">01</span>
          <h2 className="text-xl font-bold text-foreground -mt-3 mb-4">人格解读</h2>
          <div className="blob-card p-6 sm:p-8">
            <p className="text-sm text-secondary-foreground leading-relaxed">
              {persona.summary}
            </p>
          </div>
        </motion.section>

        {/* ===== 02 DIMENSION ANALYSIS ===== */}
        {scoreEntries.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mb-12"
          >
            <span className="text-5xl font-black text-muted-foreground/15">02</span>
            <h2 className="text-xl font-bold text-foreground -mt-3 mb-4">维度分析</h2>
            <div className="blob-card-alt p-6 sm:p-8 flex flex-col gap-6">
              {scoreEntries.map(([dim, score], i) => (
                <motion.div
                  key={dim}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                  className="flex flex-col gap-2"
                >
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-foreground">{dim}</span>
                    <span className="font-bold tabular-nums" style={{ color: DIM_COLORS[i % DIM_COLORS.length] }}>
                      {score}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden relative">
                    <motion.div
                      className="h-full rounded-full relative"
                      style={{
                        background: `linear-gradient(90deg, ${DIM_COLORS[i % DIM_COLORS.length]}, color-mix(in srgb, ${DIM_COLORS[i % DIM_COLORS.length]} 60%, transparent))`,
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(score, 100)}%` }}
                      transition={{ duration: 0.8, delay: 0.5 + i * 0.08, ease: "easeOut" }}
                    />
                    {/* Blob endpoint */}
                    <motion.div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: DIM_COLORS[i % DIM_COLORS.length],
                        borderRadius: "60% 40% 55% 45%",
                        boxShadow: `0 0 12px ${DIM_COLORS[i % DIM_COLORS.length]}60`,
                      }}
                      initial={{ left: 0 }}
                      animate={{ left: `${Math.min(score, 100)}%` }}
                      transition={{ duration: 0.8, delay: 0.5 + i * 0.08, ease: "easeOut" }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* ===== 03 RECOMMENDATIONS ===== */}
        {(persona.matched_result || suggestions.length > 0) && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="mb-12"
          >
            <span className="text-5xl font-black text-muted-foreground/15">03</span>
            <h2 className="text-xl font-bold text-foreground -mt-3 mb-4">推荐</h2>

            {persona.matched_result && (
              <div className="blob-card p-6 mb-4">
                <p className="text-xs text-muted-foreground mb-1">匹配结果</p>
                <p className="text-2xl font-black text-foreground mb-2">
                  {persona.matched_result.name}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {persona.matched_result.reason}
                </p>
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { emoji: "🌟", label: "你的优势" },
                  { emoji: "🔮", label: "隐藏特质" },
                  { emoji: "🌱", label: "行动建议" },
                ].map((card, i) => (
                  <div key={card.label} className="blob-card-subtle p-4 flex flex-col gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {card.emoji} {card.label}
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {suggestions[i] || suggestions[0]}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </motion.section>
        )}

        {/* ===== CTA ===== */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="flex flex-col items-center gap-3 pt-4"
        >
          {page && (
            <>
              <motion.button
                whileTap={{ scale: 0.96 }}
                whileHover={{ scale: 1.02 }}
                onClick={handleViewPage}
                className="btn-primary w-full sm:w-auto px-10"
              >
                查看专属页面
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleCopyLink}
                className="btn-glass justify-center w-full sm:w-auto px-8"
              >
                {copied ? (
                  <>✓ 已复制链接</>
                ) : (
                  <>复制分享链接</>
                )}
              </motion.button>
            </>
          )}
          <button
            onClick={() => router.push("/")}
            className="text-sm text-muted-foreground hover:text-foreground transition py-2"
          >
            返回首页重新测试
          </button>
        </motion.div>

        {!bgImg && (
          <p className="text-center text-muted-foreground/30 text-xs mt-8">
            AI 正在生成视觉背景...
          </p>
        )}
      </div>
    </div>
  );
}
