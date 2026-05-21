"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/supabase/auth-context";

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!email.trim() || !password || !confirm) {
      setError("请填写所有字段");
      return;
    }
    if (password.length < 6) {
      setError("密码长度至少 6 位");
      return;
    }
    if (password !== confirm) {
      setError("两次密码不一致");
      return;
    }
    setLoading(true);
    const errMsg = await signUp(email.trim(), password);
    setLoading(false);
    if (errMsg) {
      setError(errMsg);
    } else {
      setSuccess("注册成功！请检查邮箱确认链接，或直接登录。");
      setTimeout(() => router.push("/login"), 2500);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background: single organic blob */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[-15%] w-[500px] h-[500px] bg-primary/6 animate-blob" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="blob-card p-8">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-6">
              <span className="w-8 h-8 flex items-center justify-center bg-primary/10 text-primary font-black text-sm"
                style={{ borderRadius: "60% 40% 55% 45%" }}
              >
                PF
              </span>
              <span className="text-foreground font-bold text-lg">PersonaFlow</span>
            </Link>
            <h1 className="text-2xl font-black text-foreground">创建账号</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 glass border border-border rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary/50 outline-none transition text-foreground placeholder:text-muted-foreground"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位字符"
                className="w-full px-4 py-3 glass border border-border rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary/50 outline-none transition text-foreground placeholder:text-muted-foreground"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">确认密码</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="再次输入密码"
                className="w-full px-4 py-3 glass border border-border rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary/50 outline-none transition text-foreground placeholder:text-muted-foreground"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-400 text-sm text-center bg-red-500/10 py-2.5 rounded-xl border border-red-500/20"
              >
                {error}
              </motion.p>
            )}
            {success && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-emerald-400 text-sm text-center bg-emerald-500/10 py-2.5 rounded-xl border border-emerald-500/20"
              >
                {success}
              </motion.p>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={loading}
              type="submit"
              className="w-full py-3 gradient-cta text-foreground font-semibold rounded-full transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {loading ? "注册中..." : "注册"}
            </motion.button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            已有账号？{" "}
            <Link href="/login" className="text-pf-purple font-medium hover:underline">
              立即登录
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
