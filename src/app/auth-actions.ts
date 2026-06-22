"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, getAuthConfig, makeToken } from "@/lib/auth";

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "/");
  const cfg = getAuthConfig();

  if (!cfg.enabled || password !== cfg.password) {
    const back = from && from.startsWith("/") ? `&from=${encodeURIComponent(from)}` : "";
    redirect(`/login?error=1${back}`);
  }

  const token = await makeToken(cfg.password, cfg.secret);
  const jar = await cookies();
  jar.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 60, // 60 dias
  });

  redirect(from.startsWith("/") ? from : "/");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE);
  redirect("/login");
}
