"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

export default function SharePage() {
  const [page, setPage] = useState<PageData | null>(null);
  const [persona, setPersona] = useState<PersonaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const slug = window.location.pathname.split("/").pop();
    if (!slug) return;
    loadData(slug);

    const timer = setInterval(() => {
      const supabase = createClient();
      supabase
        .from("generated_pages")
        .select("background_image_url, hero_image_url")
        .eq("share_slug", slug)
        .eq("is_public", true)
        .single()
        .then(({ data }) => {
          if (data && (data.background_image_url || data.hero_image_url)) {
            setPage((prev) => prev ? { ...prev, ...data } : prev);
          }
        });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  async function loadData(slug: string) {
    const supabase = createClient();
    const { data, error: dbErr } = await supabase
      .from("generated_pages")
      .select(
        "id, page_config, share_slug, background_image_url, hero_image_url, character_image_url, persona_result_id"
      )
      .eq("share_slug", slug)
      .eq("is_public", true)
      .single();

    if (dbErr || !data) {
      setError("页面不存在或已设为私密");
    } else {
      setPage(data as PageData);

      // Load persona for richer display
      const { data: personaData } = await supabase
        .from("persona_results")
        .select("title, summary, tags, dimension_scores, matched_result, suggestions")
        .eq("id", data.persona_result_id)
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

  if (error || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/6 blur-[100px]" />
        </div>
        <div className="relative blob-card p-8 max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full glass flex items-center justify-center border border-border">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-foreground text-lg font-medium mb-2">
            {error || "页面不存在"}
          </p>
          <p className="text-muted-foreground text-sm mb-6">
            这个分享链接可能已经失效
          </p>
          <Link href="/" className="btn-primary inline-flex">
            创建我的专属问卷
          </Link>
        </div>
      </div>
    );
  }

  return <ExclusivePageRenderer page={page} persona={persona} isPublic />;
}
