"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import ExclusivePageRenderer from "@/components/ExclusivePageRenderer";

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
  page_config: Record<string, unknown>;
  background_image_url: string | null;
  hero_image_url: string | null;
  character_image_url: string | null;
  share_slug: string;
  persona_result_id: string;
};

export default function GeneratedPageView() {
  const router = useRouter();
  const [page, setPage] = useState<PageData | null>(null);
  const [persona, setPersona] = useState<PersonaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [regeneratingImages, setRegeneratingImages] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    const pathId = window.location.pathname.split("/").pop();
    if (!pathId) return;
    loadData(pathId);

    const timer = setInterval(() => {
      setPollCount((c) => {
        if (c > 24) return c; // Stop polling after ~2 min (24 * 5s)
        const supabase = createClient();
        supabase
          .from("generated_pages")
          .select("background_image_url, hero_image_url, character_image_url")
          .eq("id", pathId)
          .single()
          .then(({ data }) => {
            if (data && (data.background_image_url || data.hero_image_url)) {
              setPage((prev) => (prev ? { ...prev, ...data } : prev));
            }
          });
        return c + 1;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  async function handleRegenerateImages() {
    if (!page?.persona_result_id) return;
    setRegeneratingImages(true);
    const supabase = createClient();
    const { error } = await supabase.functions.invoke("generate-page-visual", {
      body: { personaResultId: page.persona_result_id },
    });
    if (error) {
      console.warn("Image regeneration error:", error);
    }
    setRegeneratingImages(false);
    // Immediately poll once
    const { data } = await supabase
      .from("generated_pages")
      .select("background_image_url, hero_image_url")
      .eq("id", page.id)
      .single();
    if (data) {
      setPage((prev) => (prev ? { ...prev, ...data } : prev));
    }
  }

  async function loadData(id: string) {
    const supabase = createClient();

    const { data: pageData } = await supabase
      .from("generated_pages")
      .select(
        "id, page_config, share_slug, background_image_url, hero_image_url, character_image_url, persona_result_id"
      )
      .eq("id", id)
      .single();

    if (pageData) {
      setPage(pageData as PageData);

      const { data: personaData } = await supabase
        .from("persona_results")
        .select("title, summary, tags, dimension_scores, matched_result, suggestions")
        .eq("id", pageData.persona_result_id)
        .single();
      if (personaData) setPersona(personaData as PersonaData);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-3 h-3 rounded-full bg-primary"
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="blob-card p-8 max-w-md text-center">
          <p className="text-muted-foreground mb-4">页面不存在</p>
          <button onClick={() => router.push("/")} className="btn-primary">
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <ExclusivePageRenderer
      page={page}
      persona={persona}
      onRegenerateImages={handleRegenerateImages}
      regeneratingImages={regeneratingImages}
    />
  );
}
