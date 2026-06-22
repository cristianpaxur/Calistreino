import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return { url, key };
}

/** Cliente Supabase por-request (lê a sessão dos cookies → RLS por auth.uid()). */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = env();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Chamado de um Server Component (cookies read-only).
          // O refresh de sessão é feito no middleware.
        }
      },
    },
  });
}
