"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Cliente Supabase para uso no navegador (login/signup/logout). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
