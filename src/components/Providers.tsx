"use client";

import { AuthProvider } from "@/lib/supabase/auth-context";
import { ThemeProvider } from "@/lib/theme/ThemeContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AuthProvider>
  );
}
