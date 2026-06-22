"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { applyPlanAdjustment } from "@/app/actions";
import type { PlanAdjustment } from "@/lib/coach";

const KIND_META: Record<
  PlanAdjustment["kind"],
  { label: string; color: string }
> = {
  advance: { label: "AVANÇAR", color: "#D6FB3D" },
  hold: { label: "SEGURAR", color: "#FFC14D" },
  deload: { label: "DELOAD", color: "#FF8A4D" },
  volume: { label: "VOLUME", color: "#9AD0FF" },
};

export default function AdjustmentsPanel({
  adjustments,
  programId,
  week,
  canApply,
}: {
  adjustments: PlanAdjustment[];
  programId: string | null;
  week: number;
  /** false quando estamos na semente (sem programa real) — só exibe, não aplica. */
  canApply: boolean;
}) {
  const router = useRouter();
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!adjustments.length) {
    return (
      <div className="card mt-3.5">
        <div className="font-mono text-[10px] tracking-[0.16em] text-muted-2">
          AJUSTES SUGERIDOS
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Nenhum ajuste agora — mantenha o plano e progrida em pequenos incrementos.
        </p>
      </div>
    );
  }

  async function apply(idx: number, adj: PlanAdjustment) {
    if (!programId) return;
    setBusy(idx);
    setError(null);
    try {
      const res = await applyPlanAdjustment({
        programId,
        week,
        kind: adj.kind,
        skillSlug: adj.skillSlug,
        skillName: adj.skillName,
        reasons: adj.reasons,
        fromLever: adj.fromLever,
        toLever: adj.toLever,
      });
      if (res.ok) {
        setApplied((s) => new Set(s).add(idx));
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao aplicar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card mt-3.5">
      <div className="font-mono text-[10px] tracking-[0.16em] text-muted-2">
        AJUSTES SUGERIDOS
      </div>

      {error && (
        <p
          className="mt-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "rgba(255,68,56,.12)", color: "#FF6F66" }}
        >
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2.5">
        {adjustments.map((adj, i) => {
          const meta = KIND_META[adj.kind];
          const isApplied = applied.has(i);
          const applicable = canApply && adj.kind === "advance" && !!adj.toLever;
          return (
            <div
              key={i}
              className="rounded-[13px] border bg-surface p-3.5"
              style={{ borderColor: "rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono text-[9px] tracking-[0.16em]"
                    style={{ color: meta.color }}
                  >
                    {meta.label}
                  </span>
                  {adj.skillName && (
                    <span className="font-mono text-[9px] tracking-[0.12em] text-muted-2">
                      {adj.skillName.toUpperCase()}
                    </span>
                  )}
                </div>
                {applicable &&
                  (isApplied ? (
                    <span className="font-mono text-[9px] tracking-[0.14em] text-accent">
                      APLICADO ✓
                    </span>
                  ) : (
                    <button
                      onClick={() => apply(i, adj)}
                      disabled={busy === i}
                      className="btn-lime h-8 px-3 text-[12px] disabled:opacity-60"
                    >
                      {busy === i ? "..." : "APLICAR"}
                    </button>
                  ))}
              </div>

              {adj.kind === "advance" && adj.toLever && (
                <p className="mt-1.5 text-[13px] text-ink-soft">
                  {adj.fromLever ? `${adj.fromLever} → ` : ""}
                  <span className="text-accent">{adj.toLever}</span>
                </p>
              )}

              {adj.reasons.slice(0, 2).map((r, j) => (
                <p key={j} className="mt-1 text-[12px] leading-[1.45] text-muted">
                  {r}
                </p>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
