"use client";

import { useState } from "react";
import { completeGoalAndStartNext } from "@/app/actions";

export default function GoalCompletePanel() {
  const [busy, setBusy] = useState(false);

  async function next() {
    setBusy(true);
    try {
      await completeGoalAndStartNext();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="mt-3.5 animate-fadeUp rounded-2xl p-[18px]"
      style={{
        background: "linear-gradient(180deg, rgba(214,251,61,.16), rgba(214,251,61,.04))",
        border: "1px solid rgba(214,251,61,.35)",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">🏆</span>
        <span className="font-mono text-[10px] tracking-[0.16em] text-accent">
          OBJETIVO CONCLUÍDO
        </span>
      </div>
      <p className="mt-2 text-[15px] font-medium leading-[1.5] text-ink">
        Você bateu todas as metas deste ciclo. Fim de uma meta é o começo da próxima
        — escolha seu novo objetivo e gere o próximo plano.
      </p>
      <button
        onClick={next}
        disabled={busy}
        className="btn-lime mt-3.5 h-11 w-full text-[14px] disabled:opacity-60"
      >
        {busy ? "ABRINDO..." : "DEFINIR PRÓXIMO OBJETIVO"}
      </button>
    </div>
  );
}
