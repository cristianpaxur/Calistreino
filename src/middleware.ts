import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, getAuthConfig, makeToken, safeEqual } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const cfg = getAuthConfig();
  // Sem senha configurada → app aberto (modo dev/local).
  if (!cfg.enabled) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login")) return NextResponse.next();

  const token = req.cookies.get(AUTH_COOKIE)?.value ?? "";
  const expected = await makeToken(cfg.password, cfg.secret);

  if (token && safeEqual(token, expected)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  if (pathname !== "/") url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Protege tudo, menos assets internos e arquivos estáticos (com extensão).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
