// 010 — Tradução PURA de evento Stripe → atualização de assinatura. Sem IO/sem
// rede (R5): permite teste offline (verify-entitlements). O webhook (route.ts)
// faz a verificação de assinatura + idempotência (IO) e delega a decisão de tier
// para cá.
import {
  statusGrantsPro,
  type SubscriptionStatus,
  type Tier,
} from "./entitlements.ts";

/** Forma mínima do payload que consumimos do evento (subset do Stripe). */
export interface StripeEventLike {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export interface MappedSubscription {
  /** Para qual customer aplicar. */
  customerId: string | null;
  /** user_id quando o Stripe envia em metadata/client_reference_id. */
  userIdHint: string | null;
  tier: Tier;
  status: SubscriptionStatus;
  stripeSubscriptionId: string | null;
  /** ISO da virada de período (current_period_end), quando disponível. */
  currentPeriodEnd: string | null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function epochToIso(v: unknown): string | null {
  return typeof v === "number" && v > 0 ? new Date(v * 1000).toISOString() : null;
}

function metaUserId(obj: Record<string, unknown>): string | null {
  const meta = (obj.metadata as Record<string, unknown> | undefined) ?? {};
  return asString(meta.user_id) ?? asString(obj.client_reference_id);
}

/** Normaliza o status bruto do Stripe para o nosso enum. */
export function normalizeStatus(raw: unknown): SubscriptionStatus {
  const s = asString(raw);
  switch (s) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
      return s;
    default:
      return "none";
  }
}

/** Tipos de evento que efetivamente mexem na assinatura. */
export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
] as const;

export function isHandledEvent(type: string): boolean {
  return (HANDLED_EVENTS as readonly string[]).includes(type);
}

/** Decisão pura: dado o evento, devolve como ficar a assinatura. Retorna null
 *  para eventos que não tratamos. */
export function mapEventToSubscription(
  event: StripeEventLike
): MappedSubscription | null {
  if (!isHandledEvent(event.type)) return null;
  const obj = event.data.object ?? {};

  if (event.type === "checkout.session.completed") {
    // A sessão confirma o pagamento; o status definitivo vem nos eventos de
    // subscription, mas já marcamos pro/active para liberar imediatamente.
    return {
      customerId: asString(obj.customer),
      userIdHint: metaUserId(obj),
      tier: "pro",
      status: "active",
      stripeSubscriptionId: asString(obj.subscription),
      currentPeriodEnd: null,
    };
  }

  // customer.subscription.*
  const status = normalizeStatus(obj.status);
  const grantsPro = statusGrantsPro(status);
  const deleted = event.type === "customer.subscription.deleted";
  return {
    customerId: asString(obj.customer),
    userIdHint: metaUserId(obj),
    tier: deleted || !grantsPro ? "free" : "pro",
    status: deleted ? "canceled" : status,
    stripeSubscriptionId: asString(obj.id),
    currentPeriodEnd: epochToIso(obj.current_period_end),
  };
}
