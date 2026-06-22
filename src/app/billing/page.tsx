import Link from "next/link";
import { getTier } from "@/lib/billing";
import { getStripeConfig } from "@/lib/stripe";
import BillingPanel from "@/components/BillingPanel";

export const dynamic = "force-dynamic";

// 010 — Página de billing/assinatura. Server component: lê o tier efetivo (gate
// server-side) e a config do Stripe; o estado é refletido no client (BillingPanel).
// Tolerante: sem migração/Stripe, mostra free + checkout indisponível.
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ status }, tier] = await Promise.all([searchParams, getTier()]);
  const cfg = getStripeConfig();
  const isPro = tier === "pro";

  return (
    <div className="px-[18px] pb-28 pt-14">
      <div className="flex animate-fadeUp items-center gap-3">
        <Link
          href="/configuracoes"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M15 4l-8 8 8 8" stroke="#9A9AA4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" style={{ boxShadow: "0 0 8px #D6FB3D" }} />
            <span className="font-mono text-[10px] tracking-[0.2em] text-accent">ASSINATURA</span>
          </div>
          <div className="mt-1 font-display text-[24px] leading-none">PLANO PRO</div>
        </div>
      </div>

      {status === "success" && !isPro && (
        <div
          className="mt-4 animate-fadeUp rounded-[14px] p-[15px]"
          style={{ background: "rgba(214,251,61,.06)", border: "1px solid rgba(214,251,61,.3)" }}
        >
          <p className="text-xs leading-relaxed text-[#C8C8C2]">
            Pagamento recebido. A liberação acontece assim que o Stripe confirma a
            assinatura (alguns segundos). Atualize a página se necessário.
          </p>
        </div>
      )}
      {status === "cancel" && (
        <div
          className="mt-4 animate-fadeUp rounded-[14px] p-[15px]"
          style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}
        >
          <p className="text-xs leading-relaxed text-muted">Checkout cancelado. Sem cobrança.</p>
        </div>
      )}

      <BillingPanel isPro={isPro} enabled={cfg.enabled} />
    </div>
  );
}
