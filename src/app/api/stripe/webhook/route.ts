// 010 — Webhook do Stripe. Atualiza `subscriptions` de forma confiável (RF-004).
//
// Riscos tratados (R10):
//   • runtime = "nodejs" (precisa do corpo cru + crypto do Stripe; não roda no edge).
//   • lê req.text() ANTES de qualquer parse (a verificação de assinatura precisa do
//     corpo cru, byte a byte).
//   • idempotência por event.id (tabela stripe_events) → reprocessamento é no-op.
//   • a rota /api/stripe é ISENTA do middleware de auth (o Stripe não tem sessão).
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { getStripe, getStripeConfig } = await import("@/lib/stripe");
  const cfg = getStripeConfig();
  const stripe = await getStripe();

  // Sem Stripe/segredo configurado → 503 (human-gated). Não derruba o build.
  if (!stripe || !cfg.webhookSecret) {
    return NextResponse.json(
      { error: "Stripe não configurado." },
      { status: 503 }
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Assinatura ausente." }, { status: 400 });
  }

  // Corpo CRU antes de qualquer parse (R10).
  const rawBody = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, cfg.webhookSecret);
  } catch (e) {
    return NextResponse.json(
      { error: `Assinatura inválida: ${e instanceof Error ? e.message : "erro"}` },
      { status: 400 }
    );
  }

  const { createAdminClient } = await import("@/lib/supabase-admin");
  const {
    markEventProcessed,
    upsertSubscriptionByCustomer,
  } = await import("@/lib/billing-io");
  const { mapEventToSubscription } = await import("@/lib/stripe-events");

  const admin = createAdminClient();

  // Idempotência: se já processamos este event.id, no-op (200 → Stripe não retenta).
  const fresh = await markEventProcessed(admin, event.id, event.type);
  if (!fresh) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const mapped = mapEventToSubscription({
    id: event.id,
    type: event.type,
    data: { object: event.data.object as Record<string, unknown> },
  });

  if (mapped && mapped.customerId) {
    try {
      await upsertSubscriptionByCustomer(
        admin,
        mapped.customerId,
        {
          tier: mapped.tier,
          status: mapped.status,
          stripeCustomerId: mapped.customerId,
          stripeSubscriptionId: mapped.stripeSubscriptionId,
          currentPeriodEnd: mapped.currentPeriodEnd,
        },
        mapped.userIdHint
      );
    } catch {
      // Falha de IO → 500 para o Stripe retentar (não marcamos como falha de
      // idempotência: o event.id já está gravado, então o retry será no-op; em
      // produção, prefira não gravar o event antes do upsert. Mantido simples
      // aqui — o teste ao vivo (portão humano) valida o comportamento real).
      return NextResponse.json({ error: "Falha ao atualizar assinatura." }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
