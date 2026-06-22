"use client";

import { useState, useTransition } from "react";
import { startCheckout, openBillingPortal } from "@/app/actions";

// 010 — UI de billing (client). Dispara as server actions de checkout/portal; o
// redirect acontece no servidor quando há Stripe configurado. Sem configuração,
// a action devolve erro legível e mostramos aqui (estado "indisponível").
export default function BillingPanel({
  isPro,
  enabled,
}: {
  isPro: boolean;
  enabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function checkout(plan: "monthly" | "annual") {
    setError(null);
    startTransition(async () => {
      const res = await startCheckout(plan);
      // Só retorna quando NÃO redirecionou (erro).
      if (res && !res.ok) setError(res.error);
    });
  }

  function portal() {
    setError(null);
    startTransition(async () => {
      const res = await openBillingPortal();
      if (res && !res.ok) setError(res.error);
    });
  }

  if (isPro) {
    return (
      <div className="mt-5 animate-fadeUp">
        <div
          className="card"
          style={{ border: "1px solid rgba(214,251,61,.35)", background: "rgba(214,251,61,.06)" }}
        >
          <div className="font-mono text-[10px] tracking-[0.18em] text-accent">ASSINATURA ATIVA</div>
          <div className="mt-2 font-display text-[22px] leading-tight">VOCÊ É PRO</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
            IA de plano, análise por IA e analytics avançado liberados.
          </p>
        </div>
        <button
          onClick={portal}
          disabled={pending}
          className="btn-dark mt-4 flex h-[48px] w-full text-[14px] disabled:opacity-60"
        >
          {pending ? "ABRINDO..." : "GERENCIAR ASSINATURA"}
        </button>
        {error && <ErrorBox text={error} />}
      </div>
    );
  }

  return (
    <div className="mt-5 animate-fadeUp">
      <div className="card">
        <div className="font-mono text-[10px] tracking-[0.16em] text-muted-2">INCLUI NO PRO</div>
        <ul className="mt-2.5 flex flex-col gap-1.5 text-[13px] text-ink-soft">
          <li>· Geração de plano por IA a partir da sua anamnese</li>
          <li>· Análise semanal por IA no coach</li>
          <li>· Analytics avançado de progressão</li>
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-2">
          O logger, as rotinas próprias, os timers, a voz e o coach por regras
          continuam grátis — sempre.
        </p>
      </div>

      {!enabled && (
        <div
          className="mt-4 rounded-[14px] p-[15px]"
          style={{ background: "rgba(255,193,77,.08)", border: "1px solid rgba(255,193,77,.3)" }}
        >
          <div className="font-mono text-[10px] tracking-[0.16em]" style={{ color: "#FFC14D" }}>
            CHECKOUT INDISPONÍVEL
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#C8C8C2]">
            O pagamento ainda não foi configurado neste ambiente.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2.5">
        <button
          onClick={() => checkout("monthly")}
          disabled={pending || !enabled}
          className="btn-lime flex h-[52px] w-full text-[15px] disabled:opacity-50"
        >
          {pending ? "REDIRECIONANDO..." : "ASSINAR MENSAL"}
        </button>
        <button
          onClick={() => checkout("annual")}
          disabled={pending || !enabled}
          className="btn-dark flex h-[48px] w-full text-[13px] disabled:opacity-50"
        >
          ASSINAR ANUAL
        </button>
      </div>
      {error && <ErrorBox text={error} />}
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <p
      className="mt-3 rounded-lg px-3 py-2 text-xs"
      style={{ background: "rgba(255,68,56,.12)", color: "#FF6F66" }}
    >
      {text}
    </p>
  );
}
