"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { gerarPlano } from "@/app/onboarding/actions";
import UpgradeCTA from "@/components/UpgradeCTA";

// Tela "gerando seu plano" + revisão (008 / T-008). Dispara a geração (IA
// configura o template validado; sem chave ou em falha, cai no fallback
// determinístico — sempre produz algo executável). Mostra estado de geração e,
// ao terminar, um resumo + CTA para treinar.
//
// Tolerante (R9): se o IO falhar (migração 003/007/005 não aplicada), mostra o
// erro e mantém os caminhos de fallback (builder / plano-modelo) passados como
// children pelo server.
type Result =
  | { ok: true; programId: string; origin: "ai" | "fallback"; issues: string[] }
  | { ok: false; error: string }
  | { ok: false; upgrade: true; error: string };

export default function PlanGenerator({
  canGenerate,
  fallbackSlot,
}: {
  canGenerate: boolean;
  fallbackSlot: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  function generate() {
    setResult(null);
    startTransition(async () => {
      const res = await gerarPlano();
      setResult(res);
    });
  }

  // Estado: gerando
  if (pending) {
    return (
      <div className="mt-6 animate-fadeUp">
        <div className="card flex flex-col items-center gap-3 py-10 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-accent" />
          <div className="font-display text-[20px] leading-none">MONTANDO SEU PLANO</div>
          <p className="max-w-[260px] text-[12px] leading-relaxed text-muted">
            Encaixando suas alavancas, ajustando volume e descanso aos seus dias e
            equipamento.
          </p>
        </div>
      </div>
    );
  }

  // Estado: sucesso
  if (result?.ok) {
    return (
      <div className="mt-6 animate-fadeUp">
        <div
          className="card"
          style={{ border: "1px solid rgba(214,251,61,.35)", background: "rgba(214,251,61,.06)" }}
        >
          <div className="font-mono text-[10px] tracking-[0.18em] text-accent">
            {result.origin === "ai" ? "PLANO GERADO PELA IA" : "PLANO MONTADO (TEMPLATE)"}
          </div>
          <div className="mt-2 font-display text-[22px] leading-tight">SEU PLANO ESTÁ PRONTO</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
            {result.origin === "ai"
              ? "A IA configurou um template validado com base no seu perfil."
              : "Montamos um plano seguro a partir do template do seu objetivo."}
            {" "}Ele já está ativo — é o que abre no seu treino.
          </p>
          {result.issues.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 text-[11px] text-muted-2">
              {result.issues.slice(0, 4).map((m, i) => (
                <li key={i} className="font-mono">· {m}</li>
              ))}
            </ul>
          )}
        </div>

        <Link href="/treinar" className="btn-lime mt-5 flex h-[52px] w-full text-[15px]">
          COMEÇAR A TREINAR
        </Link>
        <button
          onClick={generate}
          className="btn-dark mt-2.5 flex h-[48px] w-full text-[13px]"
        >
          GERAR DE NOVO
        </button>
        <Link
          href="/montar"
          className="mt-4 block text-center font-mono text-[11px] text-muted-2"
        >
          prefiro ajustar manualmente no builder
        </Link>
      </div>
    );
  }

  // Estado: precisa de upgrade (010 — geração por IA é Pro). Mantém os caminhos
  // grátis (builder manual / plano-modelo) abaixo do CTA.
  if (result && !result.ok && "upgrade" in result && result.upgrade) {
    return (
      <div className="mt-6 animate-fadeUp">
        <UpgradeCTA reason={result.error} />
        <div className="mt-5">{fallbackSlot}</div>
      </div>
    );
  }

  // Estado: erro
  if (result && !result.ok) {
    return (
      <div className="mt-6 animate-fadeUp">
        <div
          className="rounded-[14px] p-[15px]"
          style={{ background: "rgba(255,68,56,.08)", border: "1px solid rgba(255,68,56,.3)" }}
        >
          <div className="font-mono text-[10px] tracking-[0.16em]" style={{ color: "#FF6F66" }}>
            NÃO DEU PARA GERAR
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#C8C8C2]">{result.error}</p>
        </div>
        <button onClick={generate} className="btn-lime mt-4 flex h-[48px] w-full text-[14px]">
          TENTAR DE NOVO
        </button>
        <div className="mt-5">{fallbackSlot}</div>
      </div>
    );
  }

  // Estado: inicial
  return (
    <div className="mt-6 animate-fadeUp">
      {canGenerate ? (
        <button onClick={generate} className="btn-lime flex h-[52px] w-full text-[15px]">
          GERAR MEU PLANO
        </button>
      ) : (
        <div
          className="rounded-[14px] p-[15px]"
          style={{ background: "rgba(255,193,77,.08)", border: "1px solid rgba(255,193,77,.3)" }}
        >
          <div className="font-mono text-[10px] tracking-[0.16em]" style={{ color: "#FFC14D" }}>
            FALTA A ANAMNESE
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#C8C8C2]">
            Complete a anamnese para a IA montar seu plano.
          </p>
          <Link
            href="/onboarding/anamnese"
            className="btn-lime mt-3 flex h-[44px] w-full text-[13px]"
          >
            FAZER ANAMNESE
          </Link>
        </div>
      )}
      <div className="mt-5">{fallbackSlot}</div>
    </div>
  );
}
