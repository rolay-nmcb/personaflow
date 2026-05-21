"use client";

import { motion } from "framer-motion";
import Link from "next/link";

type PersonaData = {
  title: string;
  summary: string;
  tags: string[];
  dimension_scores: Record<string, number>;
  matched_result: { name: string; reason: string } | null;
  suggestions: string[];
};

type PageData = {
  id: string;
  page_config: Record<string, unknown> | null;
  background_image_url: string | null;
  hero_image_url: string | null;
  character_image_url: string | null;
  share_slug: string;
};

type Props = {
  page: PageData;
  persona: PersonaData | null;
  isPublic?: boolean;
  onRegenerateImages?: () => void;
  regeneratingImages?: boolean;
};

const DIM_GRADIENTS = [
  "from-pf-indigo to-pf-cyan",
  "from-pf-purple to-pf-pink",
  "from-pf-cyan to-pf-blue",
  "from-amber-500 to-amber-400",
  "from-pink-500 to-pf-pink",
];

const DIM_COLORS = ["#22D3EE", "#F0ABFC", "#60A5FA", "#F59E0B", "#EC4899"];

const TAG_PRESETS = ["chip-purple", "chip-indigo", "chip-cyan", "chip-pink"];

const DEEP_CARDS = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    ),
    label: "你的优势",
    color: "chip-purple",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
    label: "你的隐藏面",
    color: "chip-cyan",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
      </svg>
    ),
    label: "相处建议",
    color: "chip-pink",
  },
];

function SharePreview({ title }: { title: string }) {
  return (
    <div className="blob-card p-4 flex flex-col gap-3 w-[280px]">
      <div className="w-full h-56 rounded-2xl bg-gradient-to-br from-primary/15 via-card to-primary/15 flex flex-col items-center justify-center gap-3 p-6">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-pf-purple to-pf-cyan" />
        <span className="text-sm font-bold text-foreground text-center">{title}</span>
        <span className="text-foreground/40 text-[10px] text-center leading-relaxed">
          你的人格画像已生成
          <br />
          点击探索你的专属宇宙
        </span>
        <div className="w-full h-0.5 rounded-full bg-gradient-to-r from-pf-purple to-pf-cyan" />
      </div>
      <p className="text-[10px] text-muted-foreground text-center">分享图预览</p>
    </div>
  );
}

export default function ExclusivePageRenderer({ page, persona, isPublic, onRegenerateImages, regeneratingImages }: Props) {
  const pageConfig = page.page_config as Record<string, unknown> | null;
  const hero = (pageConfig?.hero as Record<string, string>) || {};
  const bgImg = page.background_image_url;
  const heroImg = page.hero_image_url;

  // Derive tags from persona first, then page config
  const tags: string[] = persona?.tags ||
    ((pageConfig?.sections as Array<{ items?: string[] }>)?.find(
      (s) => (s as Record<string, unknown>).type === "tag-list"
    )?.items) || [];

  // Derive scores from persona first, then page config
  const rawScores = persona?.dimension_scores ||
    ((pageConfig?.sections as Array<{ data?: Record<string, number> }>)?.find(
      (s) => (s as Record<string, unknown>).type === "score-chart"
    )?.data) || {};
  const scoreEntries = Object.entries(rawScores);

  const suggestions: string[] = persona?.suggestions || [];
  const matchedResult = persona?.matched_result;
  const shareUrl = page.share_slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${page.share_slug}`
    : "";

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background: organic blob */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-primary/8 animate-blob" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-accent/5 animate-blob" style={{ animationDelay: "-4s" }} />
      </div>

      {/* AI background image overlay */}
      {bgImg && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: `url(${bgImg})` }}
        />
      )}

      {/* Dot pattern */}
      <div className="absolute inset-0 bg-dots opacity-25 pointer-events-none" />

      {/* ===== TOP NAV ===== */}
      <div className="relative z-10 flex items-center justify-between px-4 sm:px-10 py-4 glass border-b border-border">
        <Link href="/" className="text-sm font-bold text-foreground hover:opacity-80 transition">
          PersonaFlow
        </Link>
        <span className="text-xs text-muted-foreground">PersonaFlow</span>
      </div>

      <div className="relative z-10">
        {/* ===== HERO SECTION ===== */}
        <section className="flex flex-col lg:flex-row items-center gap-12 section-padding pt-14 pb-8 lg:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="flex-1 flex flex-col gap-5"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-black text-foreground leading-[1.15] tracking-tight">
              {hero.title || persona?.title || "专属人格报告"}
            </h1>
            <p className="text-base sm:text-lg text-secondary-foreground max-w-lg leading-relaxed">
              {hero.description ||
                persona?.summary ||
                "你的专属人格画像已生成。这不是模板，而是 AI 根据你的选择为你创造的个人主题空间。"}
            </p>
          </motion.div>

          {/* Hero Right */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="hidden lg:flex items-center justify-center shrink-0"
          >
            <div className="relative w-[320px] h-[320px]">
              <div className="absolute inset-0 bg-primary/8 animate-blob" />
              <div className="absolute inset-0 flex items-center justify-center">
                {heroImg ? (
                  <img
                    src={heroImg}
                    alt=""
                    className="w-48 h-48 object-cover"
                    style={{ borderRadius: "60% 40% 55% 45%" }}
                  />
                ) : (
                  <div
                    className="w-48 h-48 flex items-center justify-center bg-primary/10"
                    style={{ borderRadius: "60% 40% 55% 45%" }}
                  >
                    <span className="text-4xl">🎯</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </section>

        {/* ===== IDENTITY CARD ===== */}
        <section className="section-padding pb-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="blob-card p-6 sm:p-8 flex flex-col gap-5"
          >
            <h2 className="text-base sm:text-lg font-semibold text-foreground">人格身份卡</h2>

            <div className="flex items-start gap-5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-pf-purple to-pf-indigo flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                <span className="text-2xl sm:text-3xl font-bold text-foreground">
                  {(persona?.title || hero.title || "专")[0]}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-foreground">
                  {matchedResult?.name || persona?.title || hero.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {matchedResult?.reason || persona?.summary || ""}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.slice(0, 6).map((tag, i) => (
                    <span
                      key={tag}
                      className={`px-3 py-1 text-[11px] font-medium rounded-full border ${TAG_PRESETS[i % TAG_PRESETS.length]}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ===== DIMENSION SCORES ===== */}
        {scoreEntries.length > 0 && (
          <section className="section-padding pb-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="blob-card p-6 sm:p-8 flex flex-col gap-5"
            >
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <span>📊</span> 人格维度分析
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {scoreEntries.map(([dim, score], i) => (
                  <motion.div
                    key={dim}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 + i * 0.06 }}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-secondary-foreground">{dim}</span>
                      <span className="font-bold" style={{ color: DIM_COLORS[i % DIM_COLORS.length] }}>
                        {score}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full glass overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full bg-gradient-to-r ${DIM_GRADIENTS[i % DIM_GRADIENTS.length]}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(Number(score), 100)}%` }}
                        transition={{ duration: 0.8, delay: 0.5 + i * 0.08, ease: "easeOut" }}
                        style={{ boxShadow: `0 0 12px ${DIM_COLORS[i % DIM_COLORS.length]}40` }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </section>
        )}

        {/* ===== DEEP INTERPRETATION ===== */}
        <section className="section-padding pb-8">
          <h2 className="text-2xl sm:text-[28px] font-bold text-foreground mb-6">深度解读</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {DEEP_CARDS.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="blob-card p-6 flex flex-col gap-3.5"
              >
                <div
                  className="w-10 h-10 rounded-xl glass border border-border flex items-center justify-center"
                  style={{ color: DIM_COLORS[i % DIM_COLORS.length] }}
                >
                  {card.icon}
                </div>
                <h3 className={`text-base font-semibold ${card.color}`}>{card.label}</h3>
                <p className="text-sm text-secondary-foreground leading-relaxed">
                  {i === 0 &&
                    (suggestions[0] || "你在高压环境下展现出罕见的冷静。理性是你的第一本能。")}
                  {i === 1 &&
                    (suggestions[1] || "在理性的外壳下，藏着一颗细腻的心。偶尔的柔软时刻会让你更有魅力。")}
                  {i === 2 &&
                    (suggestions[2] || "你适合与欣赏你深度的人为伍。不要害怕展示不确定的一面。")}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ===== SHARE / CTA SECTION ===== */}
        <section className="section-padding pb-20">
          <div className="flex flex-col lg:flex-row items-center gap-10">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className="flex-1 flex flex-col gap-5"
            >
              {isPublic ? (
                <>
                  <h2 className="text-2xl sm:text-[28px] font-bold text-foreground">
                    想看看你是什么人格？
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    免费创建你的专属问卷，探索你的人格宇宙
                  </p>
                  <Link href="/" className="btn-primary gap-2 w-fit text-sm">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    免费创建
                  </Link>
                </>
              ) : (
                <>
                  <h2 className="text-2xl sm:text-[28px] font-bold text-foreground">
                    分享你的专属页面
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    让你的朋友也来探索他们的人格宇宙
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => {
                        if (shareUrl) navigator.clipboard.writeText(shareUrl);
                      }}
                      className="btn-glass gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                      </svg>
                      复制链接
                    </button>
                    <Link href="/" className="btn-primary gap-2 text-sm">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                      </svg>
                      重新生成
                    </Link>
                  </div>
                </>
              )}
            </motion.div>

            {/* Share Preview Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
              className="hidden lg:block"
            >
              <SharePreview title={String(hero.title || persona?.title || "专属人格报告")} />
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center pb-12">
          <p className="text-muted-foreground/20 text-xs">
            {isPublic
              ? "由 PersonaFlow AI 生成"
              : "预览模式 — 这是你的专属页面"}
          </p>
        </div>

        {/* AI generating indicator / Regenerate button */}
        {!isPublic && !bgImg && (
          <div className="text-center pb-8">
            {onRegenerateImages ? (
              <button
                onClick={onRegenerateImages}
                disabled={regeneratingImages}
                className="btn-glass gap-2 text-sm"
              >
                {regeneratingImages ? (
                  <>
                    <span className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                    AI 正在生成视觉背景...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                    </svg>
                    重新生成视觉背景
                  </>
                )}
              </button>
            ) : (
              <p className="text-muted-foreground/40 text-xs flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                AI 正在生成视觉背景...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
