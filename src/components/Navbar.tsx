"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth-context";
import ThemeSwitcher from "@/components/ThemeSwitcher";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <nav className="w-full h-[72px] flex items-center justify-between px-8 sm:px-20 glass fixed top-0 z-50">
      {/* Logo */}
      <Link
        href="/"
        className="flex items-center gap-2 text-foreground font-black text-lg hover:opacity-80 transition tracking-tight"
      >
        <span className="w-[34px] h-[34px] flex items-center justify-center text-foreground font-black text-base"
          style={{ borderRadius: "60% 40% 55% 45%" }}
        >
          PF
        </span>
        PersonaFlow
      </Link>

      {/* CTA */}
      <div className="flex items-center gap-3">
        <ThemeSwitcher />
        {user ? (
          <>
            <span className="text-muted-foreground text-xs hidden md:inline">
              {user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded-full text-sm font-medium glass border border-border text-secondary-foreground hover:glass[0.10] transition"
            >
              退出
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-full text-sm font-medium glass border border-border text-foreground hover:glass[0.10] transition"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 rounded-full text-sm font-semibold gradient-cta text-foreground transition-all hover:shadow-primary/50"
            >
              立即体验
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
