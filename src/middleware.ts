import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  // Sem config (build/preview) → não bloqueia.
  if (!url || !key) return res;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(toSet) {
        toSet.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;
  // 010 (R10): o webhook do Stripe é server-to-server e não tem sessão de usuário
  // → isenta /api/stripe do gate de auth (senão seria redirecionado para /login).
  if (pathname.startsWith("/api/stripe")) return res;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/auth");

  if (!user && !isAuthRoute) {
    const u = req.nextUrl.clone();
    u.pathname = "/login";
    return NextResponse.redirect(u);
  }
  if (user && pathname.startsWith("/login")) {
    const u = req.nextUrl.clone();
    u.pathname = "/";
    return NextResponse.redirect(u);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
