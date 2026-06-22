// 010 — IO de billing: lê o entitlement do usuário de `subscriptions` e expõe um
// gate server-side (`requireFeature`). TOLERANTE (R1/R9): se a migração
// `010_subscriptions.sql` ainda não foi aplicada, ou não há linha, devolve o
// entitlement free seguro — o app continua funcionando (tudo grátis liberado).
import "server-only";
import { db } from "./db";
import {
  canUse,
  effectiveTier,
  freeEntitlement,
  type Entitlement,
  type Feature,
  type SubscriptionStatus,
  type Tier,
} from "./entitlements";

export interface SubscriptionRow {
  user_id: string;
  tier: Tier;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
}

/** Lê a assinatura do usuário logado. Nunca lança por ausência de tabela/linha:
 *  qualquer erro de IO → free (default seguro). */
export async function getEntitlement(): Promise<Entitlement> {
  try {
    const sb = await db();
    const { data, error } = await sb
      .from("subscriptions")
      .select("tier,status")
      .maybeSingle();
    if (error || !data) return freeEntitlement();
    const tier = (data.tier as Tier) ?? "free";
    const status = (data.status as SubscriptionStatus) ?? "none";
    return { tier, status };
  } catch {
    return freeEntitlement();
  }
}

/** Tier efetivo do usuário (free|pro) já considerando o status. */
export async function getTier(): Promise<Tier> {
  return effectiveTier(await getEntitlement());
}

/** Gate server-side de uma feature paga. Lê o entitlement e decide.
 *  `{ allowed:false }` quando o usuário não pode usar — o caller devolve o CTA. */
export async function requireFeature(
  feature: Feature
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const ent = await getEntitlement();
  if (canUse(feature, ent)) return { allowed: true };
  const { upgradeReason } = await import("./entitlements");
  return { allowed: false, reason: upgradeReason(feature) };
}
