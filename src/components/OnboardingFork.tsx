"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { chooseOnboardingPath } from "@/app/onboarding/actions";

// Tela de bifurcação (007 / T-003). Duas portas reversíveis:
//   guided    → anamnese estruturada (/onboarding/anamnese) → geração (008)
//   freestyle → builder manual (/montar, fatia 006)
// Registra a escolha (best-effort) e navega. A navegação não depende do banco
// (R9): mesmo se a tabela `profiles` não estiver aplicada, o fork funciona.
export default function OnboardingFork({ currentPath }: { currentPath: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [going, setGoing] = useState<string | null>(null);

  function pick(path: "guided" | "freestyle", dest: string) {
    setGoing(path);
    startTransition(async () => {
      await chooseOnboardingPath(path); // best-effort; ignora falha
      router.push(dest);
    });
  }

  const busy = pending;

  return (
    <div className="px-[18px] pb-28 pt-16">
      <div className="animate-fadeUp font-mono text-[10px] tracking-[0.22em] text-muted-2">
        BEM-VINDO
      </div>
      <h1 className="mt-2 animate-fadeUp font-display text-[34px] leading-none">
        COMO VOCÊ QUER COMEÇAR?
      </h1>
      <p className="mt-2 max-w-[300px] animate-fadeUp text-[13px] leading-relaxed text-muted">
        Escolha um caminho — dá pra trocar depois, sem perder nada.
      </p>

      <div className="mt-7 flex flex-col gap-3.5">
        {/* via guiada */}
        <button
          onClick={() => pick("guided", "/onboarding/anamnese")}
          disabled={busy}
          className="card animate-fadeUp text-left transition-transform active:scale-[0.99] disabled:opacity-50"
          style={{ border: "1px solid rgba(214,251,61,.35)", background: "rgba(214,251,61,.06)" }}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.18em] text-accent">RECOMENDADO</span>
            {currentPath === "guided" && (
              <span className="chip-mono rounded-md bg-accent/15 px-1.5 py-1 text-accent">ATUAL</span>
            )}
          </div>
          <div className="mt-2 font-display text-[22px] leading-tight">ME MONTA O PLANO</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
            Uma anamnese curta (objetivo, exame físico, saúde) e a IA monta um
            programa sob medida pra você.
          </p>
          <div className="mt-3 font-mono text-[11px] text-accent">
            {going === "guided" && busy ? "abrindo…" : "começar anamnese →"}
          </div>
        </button>

        {/* via freestyle */}
        <button
          onClick={() => pick("freestyle", "/montar")}
          disabled={busy}
          className="card animate-fadeUp text-left transition-transform active:scale-[0.99] disabled:opacity-50"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.18em] text-muted-2">FREESTYLE</span>
            {currentPath === "freestyle" && (
              <span className="chip-mono rounded-md bg-white/10 px-1.5 py-1 text-muted">ATUAL</span>
            )}
          </div>
          <div className="mt-2 font-display text-[22px] leading-tight">JÁ TREINO / SÓ REGISTRAR</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            Monte sua própria rotina no builder manual ou registre sessões avulsas.
          </p>
          <div className="mt-3 font-mono text-[11px] text-muted-2">
            {going === "freestyle" && busy ? "abrindo…" : "ir para o builder →"}
          </div>
        </button>
      </div>

      <p className="mt-6 text-center font-mono text-[10px] leading-relaxed text-muted-2">
        Você pode abrir a anamnese depois em Ajustes — mesmo que entre no freestyle.
      </p>
    </div>
  );
}
