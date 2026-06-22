// Teste OFFLINE (sem rede) — 010: entitlements + mapeamento de eventos Stripe.
// Roda com type-stripping nativo do Node (v23+): node scripts/verify-entitlements.ts
//
// Cobre:
//   • T-002: canUse por feature × tier; default free; features grátis sempre livres.
//   • effectiveTier: pro só vale com status active/trialing (CA-004).
//   • T-005: mapEventToSubscription traduz os eventos do webhook em tier/status.

import {
  canUse,
  effectiveTier,
  freeEntitlement,
  statusGrantsPro,
  PAID_FEATURES,
  type Entitlement,
} from "../src/lib/entitlements.ts";
import {
  mapEventToSubscription,
  normalizeStatus,
  isHandledEvent,
  type StripeEventLike,
} from "../src/lib/stripe-events.ts";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    console.error("  ✗ " + msg);
    failures++;
  } else {
    console.log("  ✓ " + msg);
  }
}

const free: Entitlement = freeEntitlement();
const proActive: Entitlement = { tier: "pro", status: "active" };
const proTrial: Entitlement = { tier: "pro", status: "trialing" };
const proCanceled: Entitlement = { tier: "pro", status: "canceled" };
const proPastDue: Entitlement = { tier: "pro", status: "past_due" };

// ── canUse / tiers ───────────────────────────────────────────────────
console.log("canUse — gate por feature × tier");
{
  // Features grátis (não listadas) sempre liberadas, mesmo p/ free.
  // @ts-expect-error feature inexistente é tratada como livre por padrão
  check(canUse("voice_guidance", free) === true, "feature não-paga liberada no free");

  for (const f of PAID_FEATURES) {
    check(canUse(f, free) === false, `${f}: bloqueada no free`);
    check(canUse(f, proActive) === true, `${f}: liberada no pro ativo`);
    check(canUse(f, proTrial) === true, `${f}: liberada no pro em trial`);
    check(canUse(f, proCanceled) === false, `${f}: bloqueada quando pro cancelado`);
    check(canUse(f, proPastDue) === false, `${f}: bloqueada quando pro past_due`);
  }

  // Default seguro: entitlement ausente → free.
  check(canUse("ai_coach", null) === false, "entitlement null → tratado como free");
  check(canUse("ai_coach", undefined) === false, "entitlement undefined → free");
}

console.log("\neffectiveTier / statusGrantsPro");
{
  check(effectiveTier(free) === "free", "free → free");
  check(effectiveTier(proActive) === "pro", "pro+active → pro");
  check(effectiveTier(proTrial) === "pro", "pro+trialing → pro");
  check(effectiveTier(proCanceled) === "free", "pro+canceled → free (CA-004)");
  check(effectiveTier({ tier: "free", status: "active" }) === "free", "tier free vence status active");
  check(statusGrantsPro("active") && statusGrantsPro("trialing"), "active/trialing concedem pro");
  check(!statusGrantsPro("past_due") && !statusGrantsPro("none"), "past_due/none não concedem");
}

// ── normalizeStatus ──────────────────────────────────────────────────
console.log("\nnormalizeStatus");
{
  check(normalizeStatus("active") === "active", "active reconhecido");
  check(normalizeStatus("weird") === "none", "status desconhecido → none");
  check(normalizeStatus(undefined) === "none", "ausente → none");
}

// ── mapEventToSubscription ───────────────────────────────────────────
console.log("\nmapEventToSubscription — webhook → tier/status");
function ev(type: string, object: Record<string, unknown>): StripeEventLike {
  return { id: "evt_" + Math.random().toString(36).slice(2), type, data: { object } };
}
{
  check(isHandledEvent("customer.subscription.updated"), "evento de subscription é tratado");
  check(!isHandledEvent("invoice.paid"), "evento não-mapeado é ignorado");

  const completed = mapEventToSubscription(
    ev("checkout.session.completed", {
      customer: "cus_1",
      subscription: "sub_1",
      client_reference_id: "user-123",
    })
  );
  check(completed?.tier === "pro" && completed?.status === "active", "checkout completed → pro/active");
  check(completed?.customerId === "cus_1", "extrai customer id");
  check(completed?.userIdHint === "user-123", "extrai user_id do client_reference_id");

  const created = mapEventToSubscription(
    ev("customer.subscription.created", {
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      current_period_end: 1_900_000_000,
      metadata: { user_id: "user-9" },
    })
  );
  check(created?.tier === "pro" && created?.status === "active", "subscription active → pro");
  check(created?.stripeSubscriptionId === "sub_1", "extrai subscription id");
  check(!!created?.currentPeriodEnd && created.currentPeriodEnd.startsWith("20"), "converte period_end p/ ISO");
  check(created?.userIdHint === "user-9", "extrai user_id do metadata");

  const pastDue = mapEventToSubscription(
    ev("customer.subscription.updated", { id: "sub_1", customer: "cus_1", status: "past_due" })
  );
  check(pastDue?.tier === "free" && pastDue?.status === "past_due", "past_due → free, status preservado");

  const deleted = mapEventToSubscription(
    ev("customer.subscription.deleted", { id: "sub_1", customer: "cus_1", status: "canceled" })
  );
  check(deleted?.tier === "free" && deleted?.status === "canceled", "deleted → free/canceled (CA-004)");

  check(mapEventToSubscription(ev("invoice.paid", {})) === null, "evento não-mapeado → null");
}

if (failures) {
  console.error(`\n${failures} verificação(ões) falharam.`);
  process.exit(1);
}
console.log("\nTudo verde (010 offline).");
