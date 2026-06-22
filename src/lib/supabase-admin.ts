// 010 — Cliente Supabase com service_role (ignora RLS). USO RESTRITO ao webhook
// do Stripe (server-to-server, sem sessão de usuário): o webhook precisa gravar a
// assinatura do usuário identificado pelo evento, e não há cookie/sessão nesse
// contexto. NUNCA importe isto de um Server Component, client component ou rota
// acessível ao usuário (R2: service_role só em fluxos server-to-server confiáveis).
import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** Admin client (service_role). Retorna null se as envs não estiverem definidas
 *  (build/preview sem credenciais) → callers degradam com mensagem legível. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
