"use client";

import { useMemo, useState } from "react";
import { filterOptions, type ExerciseOption } from "@/lib/exercise-catalog";
import { createCustomExerciseAction } from "@/app/actions";
import { catOf, MovementChip } from "@/components/ui";
import { movementType } from "@/lib/exercise-classify";

// ExercisePicker (006 / T-001): busca na biblioteca + criar exercício custom.
// `catalog` chega pré-carregado do server (biblioteca real 005 OU fallback PLAN).
// Em `onPick`, devolve a opção escolhida (id null = nome livre/custom não-persistido).
export default function ExercisePicker({
  catalog,
  onPick,
  onClose,
}: {
  catalog: ExerciseOption[];
  onPick: (opt: ExerciseOption) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<ExerciseOption[]>(catalog);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const results = useMemo(() => filterOptions(options, q), [options, q]);
  const exact = results.some((o) => o.name.toLowerCase() === q.trim().toLowerCase());

  async function createCustom(asSkill: boolean) {
    const name = q.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    const res = await createCustomExerciseAction({ name, isSkill: asSkill });
    setCreating(false);
    if (res.ok) {
      const opt: ExerciseOption = {
        id: res.id,
        slug: null,
        name: res.name,
        category: asSkill ? "skill" : "forca",
        isSkill: asSkill,
        defaultUnit: asSkill ? "seconds" : "reps",
      };
      setOptions((prev) => [opt, ...prev]);
      onPick(opt);
    } else {
      // Migração 005 não aplicada (R1/R9): segue com nome livre, sem persistir.
      const opt: ExerciseOption = {
        id: null,
        slug: null,
        name,
        category: asSkill ? "skill" : "forca",
        isSkill: asSkill,
        defaultUnit: asSkill ? "seconds" : "reps",
      };
      onPick(opt);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur-sm">
      <div className="flex items-center gap-2.5 px-[18px] pb-2 pt-[max(env(safe-area-inset-top),18px)]">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="buscar ou nomear exercício…"
          className="input flex-1"
        />
        <button onClick={onClose} className="btn-dark h-[46px] px-4 text-[13px]">
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-28">
        {/* Criar custom quando o termo não casa exatamente */}
        {q.trim() && !exact && (
          <div className="mb-3 rounded-[13px] border border-accent/25 bg-accent/[0.06] p-3.5">
            <div className="font-mono text-[10px] tracking-[0.16em] text-accent">
              CRIAR “{q.trim().toUpperCase()}”
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => createCustom(false)}
                disabled={creating}
                className="btn-lime h-[42px] flex-1 text-[13px] disabled:opacity-50"
              >
                {creating ? "…" : "+ FORÇA/REPS"}
              </button>
              <button
                onClick={() => createCustom(true)}
                disabled={creating}
                className="btn-dark h-[42px] flex-1 text-[13px] disabled:opacity-50"
              >
                {creating ? "…" : "+ SKILL/HOLD"}
              </button>
            </div>
            {error && (
              <div className="mt-2 font-mono text-[10px] text-danger-soft">{error}</div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {results.map((o) => {
            const k = catOf(o.category);
            return (
              <button
                key={`${o.id ?? "free"}-${o.slug ?? o.name}`}
                onClick={() => onPick(o)}
                className="flex items-center gap-3 rounded-[13px] border border-white/[0.06] bg-surface px-3.5 py-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold leading-tight">{o.name}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-muted-2">
                    {o.isSkill ? "isométrico · max-hold" : "reps/séries"}
                    {o.id ? "" : " · livre"}
                  </div>
                </div>
                {/* MOV (013): selo estatico/dinamico ao lado da categoria.
                    ExerciseOption traz `defaultUnit` (sinal mais especifico:
                    seconds => ESTATICO, reps => DINAMICO); `isSkill` cobre o
                    fallback caso a unidade venha ausente. */}
                <MovementChip
                  type={movementType({ defaultUnit: o.defaultUnit, isSkill: o.isSkill })}
                />
                <span
                  className="chip-mono shrink-0 rounded-md px-1.5 py-1"
                  style={{ color: k.color, background: k.bg }}
                >
                  {k.label}
                </span>
              </button>
            );
          })}
          {!results.length && !q.trim() && (
            <div className="pt-10 text-center font-mono text-[11px] text-muted-2">
              digite para buscar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
