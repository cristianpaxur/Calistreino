// 010 — Camada de entitlements (decisão central de acesso por tier).
//
// FUNÇÃO PURA, sem IO (R5/RNF-001): o IO (ler `subscriptions` do banco) fica em
// `billing.ts`; aqui só mapeamos feature × tier. A regra de ouro da spec: a voz e
// o logger são GRÁTIS de propósito (a cunha de mercado/funil); o pago é a
// diferenciação por IA + acompanhamento.
//
// O gating é SEMPRE validado no servidor (server actions / route handlers) — o
// client só reflete o estado. Default seguro: tier = "free".

export type Tier = "free" | "pro";

/** Status da assinatura no Stripe; só `active`/`trialing` concedem `pro`. */
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "none";

/** Features gateadas. As GRÁTIS (logger, rotinas, timers, voz, coach por regras)
 *  NÃO aparecem aqui — tudo que não está listado é livre por padrão. */
export type Feature =
  | "ai_coach" // análise por IA (OpenAI) — 009
  | "ai_plan" // geração de plano por IA — 008
  | "advanced_analytics"; // analytics avançado — 009

/** Catálogo das features pagas (fonte da verdade do que exige `pro`). */
export const PAID_FEATURES: readonly Feature[] = [
  "ai_coach",
  "ai_plan",
  "advanced_analytics",
] as const;

export interface Entitlement {
  tier: Tier;
  status: SubscriptionStatus;
}

/** Default seguro: sem assinatura → free. */
export function freeEntitlement(): Entitlement {
  return { tier: "free", status: "none" };
}

/** Status que efetivamente concedem acesso `pro` (RF-004/CA-004: cancelado só
 *  perde no fim do período → enquanto `active`/`trialing`, mantém). */
export function statusGrantsPro(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}

/** Resolve o tier efetivo a partir do tier persistido + status da assinatura.
 *  Mesmo que a linha diga `pro`, um status não-ativo derruba para `free`. */
export function effectiveTier(ent: Entitlement): Tier {
  return ent.tier === "pro" && statusGrantsPro(ent.status) ? "pro" : "free";
}

/** Decisão central de acesso (RNF-001). Pura: recebe o entitlement já lido.
 *  Features não listadas em PAID_FEATURES são sempre liberadas. */
export function canUse(feature: Feature, ent: Entitlement | null | undefined): boolean {
  const e = ent ?? freeEntitlement();
  if (!PAID_FEATURES.includes(feature)) return true;
  return effectiveTier(e) === "pro";
}

/** Texto curto de CTA por feature (UI reflete; não é gate). */
export function upgradeReason(feature: Feature): string {
  switch (feature) {
    case "ai_coach":
      return "A análise por IA do coach faz parte do plano Pro.";
    case "ai_plan":
      return "A geração de plano por IA faz parte do plano Pro.";
    case "advanced_analytics":
      return "O analytics avançado faz parte do plano Pro.";
    default:
      return "Recurso disponível no plano Pro.";
  }
}
