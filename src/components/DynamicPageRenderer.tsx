"use client";

import { motion } from "framer-motion";
import {
  type TemplateConfig,
  templates,
  type TemplateId,
} from "@/components/templates";

type PageSection = {
  type: "tag-list" | "score-chart" | "text-card" | "quote-card" | "highlight-card";
  title?: string;
  items?: string[];
  data?: Record<string, number>;
  content?: string;
};

type PageConfig = {
  style?: { theme?: string; primaryColor?: string; backgroundType?: string };
  layout?: string;
  theme?: { template?: string; primaryColor?: string; cardStyle?: string; animation?: string };
  visualAssets?: { backgroundImage?: string; heroImage?: string; characterImage?: string };
  hero?: { title: string; subtitle: string; description: string };
  sections?: PageSection[];
};

type Props = {
  config: PageConfig;
  isPublic?: boolean;
  backgroundImageUrl?: string | null;
  heroImageUrl?: string | null;
};

const sectionVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: 0.08 + i * 0.1, ease: "easeOut" as const },
  }),
};

const themeMap: Record<string, TemplateId> = {
  fantasy: "fantasy",
  "幻想冒险风": "fantasy",
  "fantasy-anime": "fantasy",
  healing: "healing",
  "治愈文艺风": "healing",
  minimalist: "healing",
  tech: "tech",
  "科技未来风": "tech",
  futuristic: "tech",
  romance: "romance",
  "浪漫情感风": "romance",
};

function resolveTemplate(config: PageConfig): TemplateConfig {
  const themeStr = config.theme?.template || config.style?.theme || "";
  const tid = themeMap[themeStr] || detectTheme(config);
  return templates[tid] || templates.healing;
}

function detectTheme(config: PageConfig): TemplateId {
  const heroTitle = config.hero?.title || "";
  if (heroTitle.includes("守护") || heroTitle.includes("幻想") || heroTitle.includes("冒险"))
    return "fantasy";
  if (
    heroTitle.includes("职业") ||
    heroTitle.includes("学习") ||
    heroTitle.includes("思维") ||
    heroTitle.includes("科技")
  )
    return "tech";
  if (
    heroTitle.includes("恋爱") ||
    heroTitle.includes("心动") ||
    heroTitle.includes("情感") ||
    heroTitle.includes("浪漫")
  )
    return "romance";
  return "healing";
}

const BAR_GRADIENTS = [
  "from-pf-indigo to-pf-cyan",
  "from-pf-purple to-pf-pink",
  "from-pf-cyan to-pf-blue",
  "from-amber-500 to-amber-400",
  "from-pink-500 to-pf-pink",
];

const TAG_STYLES = [
  "chip-purple",
  "chip-indigo",
  "chip-cyan",
  "chip-pink",
];

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-primary/15"
          style={{
            left: `${10 + (i * 37) % 80}%`,
            top: `${5 + (i * 23) % 90}%`,
          }}
          animate={{ y: [0, -20, 0], opacity: [0.15, 0.5, 0.15] }}
          transition={{
            duration: 3 + (i % 3) * 2,
            repeat: Infinity,
            delay: i * 0.5,
          }}
        />
      ))}
    </div>
  );
}

function GridOverlay() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none opacity-15"
      style={{
        backgroundImage:
          "linear-gradient(rgba(34,211,238,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.08) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }}
    />
  );
}

function FloatingHearts() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-pf-pink/12 text-lg"
          style={{
            left: `${5 + (i * 41) % 90}%`,
            top: `${10 + (i * 31) % 80}%`,
          }}
          animate={{ y: [0, -30, 0], opacity: [0.08, 0.3, 0.08], scale: [1, 1.3, 1] }}
          transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.7 }}
        >
          ♥
        </motion.div>
      ))}
    </div>
  );
}

export default function DynamicPageRenderer({
  config,
  isPublic,
  backgroundImageUrl,
  heroImageUrl,
}: Props) {
  const t = resolveTemplate(config);
  const sections = config.sections || [];
  const hero = config.hero;
  const bgImg = backgroundImageUrl || config.visualAssets?.backgroundImage;
  const heroImg = heroImageUrl || config.visualAssets?.heroImage;

  return (
    <div className={`min-h-screen ${t.bgGradient} relative`}>
      {t.bgOverlay && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: t.bgOverlay }}
        />
      )}

      {bgImg && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: `url(${bgImg})` }}
        />
      )}

      {t.showDecorations && t.decorationType === "particles" && <FloatingParticles />}
      {t.showDecorations && t.decorationType === "grid" && <GridOverlay />}
      {t.showDecorations && t.decorationType === "hearts" && <FloatingHearts />}

      <div className="relative z-10">
        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center pt-20 pb-10 px-4"
        >
          {heroImg && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="mb-8"
            >
              <img
                src={heroImg}
                alt=""
                className="mx-auto object-cover"
                style={{
                  borderRadius: t.heroImageStyle.borderRadius,
                  maxHeight: t.heroImageStyle.maxHeight,
                  boxShadow: t.heroImageStyle.shadow,
                  maxWidth: "90%",
                }}
              />
            </motion.div>
          )}
          <h1 className={`text-3xl sm:text-4xl lg:text-5xl mb-3 ${t.heroTitleClass}`}>
            {hero?.title}
          </h1>
          <p className="text-lg text-muted-foreground mb-2">{hero?.subtitle}</p>
          <p className="text-sm max-w-lg mx-auto text-muted-foreground opacity-60">
            {hero?.description}
          </p>
        </motion.section>

        {/* Sections */}
        <div className="max-w-2xl mx-auto px-4 pb-20 space-y-5">
          {sections.map((section, i) => (
            <motion.div
              key={i}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              variants={sectionVariants}
            >
              {renderSection(section, t, i)}
            </motion.div>
          ))}
        </div>

        {/* Footer badge */}
        <div className="text-center pb-16">
          <p className="text-muted-foreground/30 text-sm">
            {isPublic
              ? "由 PersonaFlow AI 生成"
              : "预览模式 — 这是你的专属页面"}
          </p>
        </div>
      </div>
    </div>
  );
}

function renderSection(section: PageSection, _t: TemplateConfig, _idx: number) {
  const cardClass = "glass-card p-6 sm:p-8";

  switch (section.type) {
    case "tag-list":
      return (
        <div className={cardClass}>
          {section.title && (
            <h3 className="text-lg font-semibold mb-4 text-foreground">
              {section.title}
            </h3>
          )}
          <div className="flex flex-wrap gap-2.5">
            {section.items?.map((tag, i) => (
              <span
                key={tag}
                className={`px-4 py-2 text-sm font-medium rounded-full border ${TAG_STYLES[i % TAG_STYLES.length]}`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      );

    case "score-chart":
      return (
        <div className={cardClass}>
          {section.title && (
            <h3 className="text-lg font-semibold mb-5 text-foreground">
              {section.title}
            </h3>
          )}
          <div className="space-y-5">
            {section.data &&
              Object.entries(section.data).map(([label, score], i) => (
                <div key={label} className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-secondary-foreground">{label}</span>
                    <span className="text-accent font-semibold tabular-nums">{score}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full glass overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full bg-gradient-to-r ${BAR_GRADIENTS[i % BAR_GRADIENTS.length]}`}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${Math.min(score, 100)}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: _idx * 0.08, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      );

    case "text-card":
      return (
        <div className={cardClass}>
          {section.title && (
            <h3 className="text-lg font-semibold mb-3 text-foreground">
              {section.title}
            </h3>
          )}
          <p className="text-sm text-secondary-foreground leading-relaxed">
            {section.content}
          </p>
        </div>
      );

    case "quote-card":
      return (
        <div className="border-l-4 rounded-r-xl p-5 bg-primary/08 backdrop-blur-md border-primary/40">
          <p className="text-lg italic leading-relaxed text-foreground">
            &ldquo;{section.content}&rdquo;
          </p>
        </div>
      );

    case "highlight-card":
      return (
        <div className="rounded-2xl p-6 text-foreground bg-gradient-to-br from-pf-purple via-pf-indigo to-pf-cyan shadow-lg shadow-primary/20">
          {section.title && (
            <h3 className="text-xl font-bold mb-2">{section.title}</h3>
          )}
          <p className="opacity-90 leading-relaxed">{section.content}</p>
        </div>
      );

    default:
      return null;
  }
}
