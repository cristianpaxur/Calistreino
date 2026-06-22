"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ExerciseOption } from "@/lib/exercise-catalog";
import { saveRoutine } from "@/app/actions";
import type { RoutineInput } from "@/lib/routine";
import ExercisePicker from "@/components/ExercisePicker";
import { catOf } from "@/components/ui";

interface BuilderExercise {
  exerciseId: string | null;
  name: string;
  category: string;
  isSkill: boolean;
  prescription: string;
  restSeconds: number | null;
}
interface BuilderDay {
  code: string;
  title: string;
  exercises: BuilderExercise[];
}

let _uid = 0;
const nextCode = (n: number) => `D${n + 1}`;

// RoutineBuilder (006 / T-003): estado local 100%; persiste via saveRoutine.
export default function RoutineBuilder({ catalog }: { catalog: ExerciseOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [days, setDays] = useState<BuilderDay[]>([
    { code: "D1", title: "", exercises: [] },
  ]);
  const [active, setActive] = useState(0);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const day = days[active];

  const patchDay = (i: number, patch: Partial<BuilderDay>) =>
    setDays((prev) => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const addDay = () => {
    setDays((prev) => [...prev, { code: nextCode(prev.length), title: "", exercises: [] }]);
    setActive(days.length);
  };
  const removeDay = (i: number) => {
    if (days.length === 1) return;
    setDays((prev) => prev.filter((_, j) => j !== i));
    setActive((a) => Math.max(0, a >= i ? a - 1 : a));
  };

  const addExercise = (o: ExerciseOption) => {
    const ex: BuilderExercise = {
      exerciseId: o.id,
      name: o.name,
      category: o.category,
      isSkill: o.isSkill,
      prescription: "",
      restSeconds: o.isSkill ? 120 : 90,
    };
    patchDay(active, { exercises: [...day.exercises, ex] });
    setPicking(false);
  };
  const patchEx = (i: number, patch: Partial<BuilderExercise>) =>
    patchDay(active, {
      exercises: day.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)),
    });
  const removeEx = (i: number) =>
    patchDay(active, { exercises: day.exercises.filter((_, j) => j !== i) });

  async function save(activate: boolean) {
    setSaving(true);
    setError(null);
    const payload: RoutineInput = {
      name,
      activate,
      days: days.map((d) => ({
        code: d.code,
        title: d.title,
        exercises: d.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          name: e.name,
          isSkill: e.isSkill,
          prescription: e.prescription || null,
          targetUnit: e.isSkill ? "seconds" : "reps",
          restSeconds: e.restSeconds,
        })),
      })),
    };
    const res = await saveRoutine(payload);
    setSaving(false);
    if (res.ok) {
      router.push(activate ? "/treinar" : "/plano");
    } else {
      setError(res.error);
    }
  }

  const totalEx = days.reduce((n, d) => n + d.exercises.length, 0);

  return (
    <>
      <div className="px-[18px] pb-32 pt-14">
        <div className="animate-fadeUp font-mono text-[10px] tracking-[0.22em] text-muted-2">
          NOVA ROTINA
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="nome da rotina · ex: Push/Pull/Legs"
          className="input mt-2.5 animate-fadeUp"
        />

        {/* abas de dias */}
        <div className="mt-3.5 flex animate-fadeUp flex-wrap gap-[7px]">
          {days.map((d, i) => {
            const sel = i === active;
            return (
              <button
                key={i}
                onClick={() => setActive(i)}
                className="rounded-[11px] px-3.5 py-2.5 font-display text-[15px] transition-colors"
                style={{
                  background: sel ? "#D6FB3D" : "rgba(255,255,255,0.05)",
                  color: sel ? "#0A0A0C" : "#9A9AA4",
                }}
              >
                {d.code}
              </button>
            );
          })}
          <button
            onClick={addDay}
            className="rounded-[11px] border border-white/10 px-3.5 py-2.5 font-display text-[15px] text-muted"
          >
            +
          </button>
        </div>

        {/* título do dia */}
        <div className="mt-3.5 flex animate-fadeUp items-center gap-2">
          <input
            value={day.title}
            onChange={(e) => patchDay(active, { title: e.target.value })}
            placeholder={`título do ${day.code} · ex: Empurrada`}
            className="input flex-1"
          />
          {days.length > 1 && (
            <button
              onClick={() => removeDay(active)}
              className="btn-dark h-[46px] px-3 text-[12px] text-danger-soft"
            >
              excluir dia
            </button>
          )}
        </div>

        {/* exercícios do dia */}
        <div className="mt-4 flex flex-col gap-2.5">
          {day.exercises.map((e, i) => {
            const k = catOf(e.category);
            return (
              <div
                key={i}
                className="animate-fadeUp rounded-[14px] border border-white/[0.06] bg-surface p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold leading-tight">{e.name}</div>
                    <span
                      className="chip-mono mt-1 inline-block rounded-md px-1.5 py-1"
                      style={{ color: k.color, background: k.bg }}
                    >
                      {k.label}
                    </span>
                  </div>
                  <button
                    onClick={() => removeEx(i)}
                    className="font-mono text-[11px] text-muted-2"
                  >
                    remover
                  </button>
                </div>
                <input
                  value={e.prescription}
                  onChange={(ev) => patchEx(i, { prescription: ev.target.value })}
                  placeholder={
                    e.isSkill ? "alvo · ex: 5 × 5-9s na alavanca" : "alvo · ex: 4 × 6-10 · RIR 1-2"
                  }
                  className="input mt-2.5"
                />
                <div className="mt-2 flex items-center gap-2">
                  <span className="label">descanso (s)</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={e.restSeconds ?? ""}
                    onChange={(ev) =>
                      patchEx(i, {
                        restSeconds: ev.target.value === "" ? null : Number(ev.target.value),
                      })
                    }
                    className="input w-24"
                  />
                </div>
              </div>
            );
          })}
          {!day.exercises.length && (
            <div className="rounded-[13px] border border-dashed border-white/10 py-7 text-center font-mono text-[11px] text-muted-2">
              nenhum exercício neste dia
            </div>
          )}
        </div>

        <button
          onClick={() => setPicking(true)}
          className="btn-dark mt-3 flex h-[48px] w-full text-[14px]"
        >
          + ADICIONAR EXERCÍCIO
        </button>

        {error && (
          <div className="mt-3 font-mono text-[11px] text-danger-soft">{error}</div>
        )}

        {/* salvar */}
        <div className="mt-5 flex gap-2.5">
          <button
            onClick={() => save(false)}
            disabled={saving || !totalEx}
            className="btn-dark h-[52px] flex-1 text-[14px] disabled:opacity-40"
          >
            SALVAR
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving || !totalEx}
            className="btn-lime h-[52px] flex-1 text-[14px] disabled:opacity-40"
          >
            {saving ? "…" : "SALVAR & ATIVAR"}
          </button>
        </div>
        <div className="mt-2 text-center font-mono text-[10px] text-muted-2">
          {totalEx} exercício(s) · {days.length} dia(s)
        </div>
      </div>

      {picking && (
        <ExercisePicker
          catalog={catalog}
          onPick={addExercise}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}
