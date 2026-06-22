"use client";

import { useState } from "react";
import { saveSession } from "@/app/actions";
import type { PlanDay, PlanExercise } from "@/lib/plan";
import { CategoryChip } from "@/components/ui";

interface EntryState {
  name: string;
  category: string;
  isSkill: boolean;
  prescription: string;
  note?: string;
  lever: string;
  maxHold: string;
  sets: string;
  repsOrTime: string;
  rir: string;
  notes: string;
  done: boolean;
}

function fromPlan(ex: PlanExercise): EntryState {
  return {
    name: ex.name,
    category: ex.category,
    isSkill: !!ex.isSkill,
    prescription: ex.prescription,
    note: ex.note,
    lever: "",
    maxHold: "",
    sets: "",
    repsOrTime: "",
    rir: "",
    notes: "",
    done: true,
  };
}

export default function SessionForm({
  day,
  defaultDate,
  defaultWeek,
  defaultBlock,
  suggestedLevers,
}: {
  day: PlanDay;
  defaultDate: string;
  defaultWeek: number;
  defaultBlock: string;
  suggestedLevers: { front: string | null; planche: string | null };
}) {
  const [entries, setEntries] = useState<EntryState[]>(
    day.exercises.map(fromPlan)
  );
  const [submitting, setSubmitting] = useState(false);

  const update = (i: number, patch: Partial<EntryState>) =>
    setEntries((prev) => prev.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  const suggestLever = (name: string): string => {
    const n = name.toLowerCase();
    if (n.includes("front") || n.includes("fl")) return suggestedLevers.front ?? "";
    if (n.includes("planche")) return suggestedLevers.planche ?? "";
    return "";
  };

  return (
    <form
      action={saveSession}
      onSubmit={() => setSubmitting(true)}
      className="space-y-6"
    >
      <input type="hidden" name="day_code" value={day.code} />

      {/* Cabeçalho da sessão */}
      <div className="card grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Data</label>
          <input
            type="date"
            name="date"
            defaultValue={defaultDate}
            className="input"
            required
          />
        </div>
        <div>
          <label className="label">Semana do ciclo</label>
          <input
            type="number"
            name="week"
            inputMode="numeric"
            min={1}
            defaultValue={defaultWeek}
            className="input"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Bloco</label>
          <input
            type="text"
            name="block"
            defaultValue={defaultBlock}
            className="input"
          />
        </div>
      </div>

      {/* Exercícios */}
      <div className="space-y-3">
        {entries.map((e, i) => (
          <div
            key={i}
            className={`card transition-opacity ${e.done ? "" : "opacity-50"}`}
          >
            <input type="hidden" name="ex_name" value={e.name} />
            <input type="hidden" name="ex_category" value={e.category} />
            <input type="hidden" name="ex_is_skill" value={e.isSkill ? "1" : "0"} />
            <input type="hidden" name="ex_done" value={e.done ? "1" : "0"} />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryChip category={e.category} />
                  <span className="font-semibold">{e.name}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  Prescrição: {e.prescription}
                  {e.note && <span className="block italic">{e.note}</span>}
                </div>
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={e.done}
                  onChange={(ev) => update(i, { done: ev.target.checked })}
                  className="h-4 w-4 accent-[#D6FB3D]"
                />
                feito
              </label>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {e.isSkill && (
                <>
                  <div className="col-span-2">
                    <label className="label">Alavanca</label>
                    <input
                      name="ex_lever"
                      value={e.lever}
                      onChange={(ev) => update(i, { lever: ev.target.value })}
                      onFocus={() => {
                        if (!e.lever) {
                          const s = suggestLever(e.name);
                          if (s) update(i, { lever: s });
                        }
                      }}
                      placeholder="ex: FL straddle"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Max-hold (s)</label>
                    <input
                      name="ex_max_hold"
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      value={e.maxHold}
                      onChange={(ev) => update(i, { maxHold: ev.target.value })}
                      placeholder="7"
                      className="input"
                    />
                  </div>
                </>
              )}
              {!e.isSkill && <input type="hidden" name="ex_lever" value="" />}
              {!e.isSkill && <input type="hidden" name="ex_max_hold" value="" />}

              <div>
                <label className="label">Séries</label>
                <input
                  name="ex_sets"
                  type="number"
                  inputMode="numeric"
                  value={e.sets}
                  onChange={(ev) => update(i, { sets: ev.target.value })}
                  placeholder="5"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Tempo / reps</label>
                <input
                  name="ex_reps_or_time"
                  value={e.repsOrTime}
                  onChange={(ev) => update(i, { repsOrTime: ev.target.value })}
                  placeholder={e.isSkill ? "6s" : "8"}
                  className="input"
                />
              </div>
              <div>
                <label className="label">RIR</label>
                <input
                  name="ex_rir"
                  value={e.rir}
                  onChange={(ev) => update(i, { rir: ev.target.value })}
                  placeholder="1-2"
                  className="input"
                />
              </div>
              <div className="col-span-2 sm:col-span-4">
                <input
                  name="ex_notes"
                  value={e.notes}
                  onChange={(ev) => update(i, { notes: ev.target.value })}
                  placeholder="Obs. do exercício (opcional)"
                  className="input"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dor / RPE da sessão */}
      <div className="card grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">🦾 Cotovelo (0-10)</label>
          <input
            type="number"
            name="elbow_pain"
            inputMode="numeric"
            min={0}
            max={10}
            placeholder="0"
            className="input"
          />
          <p className="mt-1 text-xs text-muted">≥ 3 por 2 sessões → deload.</p>
        </div>
        <div>
          <label className="label">🔻 Lombar (0-10)</label>
          <input
            type="number"
            name="lower_back"
            inputMode="numeric"
            min={0}
            max={10}
            placeholder="0"
            className="input"
          />
          <p className="mt-1 text-xs text-muted">
            &gt; 0 em estáticos → revise técnica.
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notas da sessão</label>
          <textarea
            name="notes"
            rows={2}
            placeholder="Como foi o treino, sensações, ajustes..."
            className="input resize-none"
          />
        </div>
      </div>

      <div className="sticky bottom-20 z-10 md:bottom-4">
        <button type="submit" disabled={submitting} className="btn-lime flex h-12 w-full text-[16px]">
          {submitting ? "Salvando..." : "Salvar sessão"}
        </button>
      </div>
    </form>
  );
}
