// 010 — Wrapper fino do Stripe. Igual ao padrão do OpenAI (ai.ts): a integração é
// OPCIONAL e human-gated. Sem `STRIPE_SECRET_KEY` (ou sem o pacote `stripe`
// instalado), `getStripe()` devolve null e os callers degradam com mensagem
// legível — o build continua verde sem credenciais (regra de ouro da §4).
//
// Por que import dinâmico: `stripe` não é dependência instalada nesta fatia
// (portão humano: `npm i stripe`). O import só acontece em runtime quando há
// chave, então `next build` não exige o módulo.
import "server-only";

export function getStripeConfig() {
  const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const priceMonthly = process.env.STRIPE_PRICE_MONTHLY ?? "";
  const priceAnnual = process.env.STRIPE_PRICE_ANNUAL ?? "";
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return {
    secretKey,
    webhookSecret,
    priceMonthly,
    priceAnnual,
    appUrl,
    enabled: secretKey.trim().length > 0,
  };
}

/** Tipo mínimo do que usamos — evita depender dos tipos do pacote no build. */
type StripeLike = {
  checkout: {
    sessions: {
      create: (args: Record<string, unknown>) => Promise<{ id: string; url: string | null }>;
    };
  };
  billingPortal: {
    sessions: {
      create: (args: Record<string, unknown>) => Promise<{ url: string }>;
    };
  };
  webhooks: {
    constructEvent: (body: string | Buffer, sig: string, secret: string) => {
      id: string;
      type: string;
      data: { object: Record<string, unknown> };
    };
  };
  customers: {
    create: (args: Record<string, unknown>) => Promise<{ id: string }>;
  };
};

let cached: StripeLike | null | undefined;

/** Instância do Stripe ou null se não configurado/instalado. */
export async function getStripe(): Promise<StripeLike | null> {
  if (cached !== undefined) return cached;
  const { secretKey, enabled } = getStripeConfig();
  if (!enabled) {
    cached = null;
    return null;
  }
  try {
    // Import dinâmico por nome de variável evita que o bundler tente resolver o
    // módulo em build quando ele não está instalado.
    const mod = "stripe";
    const StripeCtor = (await import(/* webpackIgnore: true */ mod)).default as new (
      key: string,
      opts?: Record<string, unknown>
    ) => StripeLike;
    cached = new StripeCtor(secretKey, { apiVersion: "2024-06-20" });
    return cached;
  } catch {
    cached = null;
    return null;
  }
}
