import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: Request) {
  return await updateSession(request as any);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
