// 010 — IO de Stripe ↔ Supabase. Duas frentes:
//   1) Fluxo do usuário (checkout/portal): lê/cria o stripe_customer_id da linha
//      do próprio usuário (RLS por auth.uid()).
//   2) Fluxo do webhook (server-to-server, sem sessão): usa a service_role para
//      gravar a assinatura e a idempotência. Por isso este módulo separa as duas
//      famílias de funções. NUNCA chame as funções de admin de um contexto com
//      sessão de usuário.
import "server-only";
import { db } from "./db";
import type { SubscriptionStatus, Tier } from "./entitlements";

type StripeLike = {
  customers: { create: (args: Record<string, unknown>) => Promise<{ id: string }> };
};

// ── Fluxo do usuário (RLS) ───────────────────────────────────────────

/** stripe_customer_id da assinatura do usuário logado (ou null). */
export async function getCustomerId(): Promise<string | null> {
  try {
    const sb = await db();
    const { data, error } = await sb
      .from("subscriptions")
      .select("stripe_customer_id")
      .maybeSingle();
    if (error || !data) return null;
    return (data.stripe_customer_id as string | null) ?? null;
  } catch {
    return null;
  }
}

/** Garante um customer no Stripe para o usuário, persistindo o id na linha de
 *  subscription (cria a linha free se ainda não existir). Reusa se já houver.
 *
 *  A LEITURA do customer existente passa pelo RLS (linha do próprio usuário). A
 *  ESCRITA usa a service_role (admin): a tabela `subscriptions` não tem policy de
 *  insert/update para usuários comuns de propósito (RNF-001 — o client não pode
 *  forjar tier='pro'). Aqui só gravamos o stripe_customer_id; tier/status nascem
 *  do default ('free'/'none') e só mudam via webhook. */
export async function getOrCreateCustomerId(
  stripe: StripeLike,
  userId: string,
  email?: string
): Promise<string> {
  const existing = await getCustomerId();
  if (existing) return existing;

  const customer = await stripe.customers.create({
    email,
    metadata: { user_id: userId },
  });

  const { createAdminClient } = await import("./supabase-admin");
  const admin = createAdminClient();
  if (!admin) {
    // Sem service_role (build/preview) → não persiste, mas devolve o id para não
    // travar o fluxo; o webhook reamarrará pelo customer/metadata.
    return customer.id;
  }
  // upsert idempotente por PK (user_id). service_role passa por cima do RLS.
  const { error } = await admin
    .from("subscriptions")
    .upsert(
      { user_id: userId, stripe_customer_id: customer.id, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (error) throw error;
  return customer.id;
}

// ── Fluxo do webhook (service_role, sem sessão) ──────────────────────

export interface SubscriptionUpdate {
  tier: Tier;
  status: SubscriptionStatus;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: string | null;
}

/** Marca um event.id como processado. Retorna false se já existia (duplicado →
 *  o webhook deve ser no-op). Idempotência (R10/RNF-002). */
export async function markEventProcessed(
  admin: ReturnType<typeof import("./supabase-admin").createAdminClient>,
  eventId: string,
  type: string
): Promise<boolean> {
  if (!admin) return true; // sem admin client → segue (degradação); não há persistência
  const { error } = await admin.from("stripe_events").insert({ id: eventId, type });
  if (error) {
    // PK duplicada (23505) → já processado.
    return false;
  }
  return true;
}

/** Atualiza/insere a assinatura do usuário a partir do evento do Stripe. Resolve
 *  o user_id por stripe_customer_id ou pelo argumento explícito. */
export async function upsertSubscriptionByCustomer(
  admin: ReturnType<typeof import("./supabase-admin").createAdminClient>,
  customerId: string,
  update: SubscriptionUpdate,
  userIdHint?: string | null
): Promise<void> {
  if (!admin) return;

  let userId = userIdHint ?? null;
  if (!userId) {
    const { data } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    userId = (data?.user_id as string | undefined) ?? null;
  }
  if (!userId) return; // sem como amarrar o evento a um usuário → ignora

  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      tier: update.tier,
      status: update.status,
      stripe_customer_id: update.stripeCustomerId ?? customerId,
      stripe_subscription_id: update.stripeSubscriptionId ?? null,
      current_period_end: update.currentPeriodEnd ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}
