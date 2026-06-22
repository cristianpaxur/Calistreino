"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanDay, PlanExercise } from "@/lib/plan";
import { saveWorkout, type WorkoutInput } from "@/app/actions";
import { catOf } from "@/components/ui";
import { useVoiceCommands, speak } from "@/components/useVoiceCommands";

interface EntryState {
  name: string;
  category: string;
  isSkill: boolean;
  prescription: string;
  lever: string;
  holds: number[];
  setsDone: number;
  done: boolean;
}

function fromPlan(ex: PlanExercise): EntryState {
  return {
    name: ex.name,
    category: ex.category,
    isSkill: !!ex.isSkill,
    prescription: ex.prescription,
    lever: "",
    holds: [],
    setsDone: 0,
    done: false,
  };
}

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.start();
    o.stop(ctx.currentTime + 0.37);
  } catch {
    /* sem áudio */
  }
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(60);
}

export default function WorkoutPlayer({
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
  const router = useRouter();
  const [entries, setEntries] = useState<EntryState[]>(() =>
    day.exercises.map((ex) => {
      const e = fromPlan(ex);
      if (e.isSkill) {
        const n = e.name.toLowerCase();
        if (n.includes("front") || n.includes("fl")) e.lever = suggestedLevers.front ?? "";
        else if (n.includes("planche")) e.lever = suggestedLevers.planche ?? "";
      }
      return e;
    })
  );
  const total = day.exercises.length;
  const [step, setStep] = useState(0);
  const isSummary = step >= total;

  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState<number | null>(null);
  const [holdRunning, setHoldRunning] = useState(false);
  const [holdMs, setHoldMs] = useState(0);
  const holdStart = useRef(0);

  const [elbow, setElbow] = useState<number | null>(null);
  const [back, setBack] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [voice, setVoice] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed((e) => (savedId === null ? e + 1 : e));
      setRest((r) => {
        if (r === null) return null;
        if (r <= 1) {
          beep();
          return null;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [savedId]);

  useEffect(() => {
    if (!holdRunning) return;
    const id = setInterval(() => setHoldMs(Date.now() - holdStart.current), 100);
    return () => clearInterval(id);
  }, [holdRunning]);

  const update = (i: number, patch: Partial<EntryState>) =>
    setEntries((prev) => prev.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  const cur = !isSummary ? entries[step] : null;
  const doneCount = entries.filter((e) => e.done).length;

  const startHold = () => {
    holdStart.current = Date.now();
    setHoldMs(0);
    setHoldRunning(true);
    setRest(null);
  };
  const stopHold = () => {
    const secs = Math.max(1, Math.round(holdMs / 1000));
    beep();
    setHoldRunning(false);
    setHoldMs(0);
    update(step, { holds: [...entries[step].holds, secs], done: true });
    setRest(cur?.isSkill ? 120 : 90);
    if (voice) speak(`${secs} ${secs === 1 ? "segundo" : "segundos"}`);
  };
  const addSet = () => {
    update(step, { setsDone: (cur?.setsDone ?? 0) + 1, done: true });
    setRest(90);
  };
  const subSet = () => update(step, { setsDone: Math.max(0, (cur?.setsDone ?? 0) - 1) });
  const next = () => {
    setHoldRunning(false);
    setHoldMs(0);
    setStep((s) => Math.min(s + 1, total));
  };
  const prev = () => {
    setHoldRunning(false);
    setHoldMs(0);
    setStep((s) => Math.max(s - 1, 0));
  };

  async function save() {
    setSaving(true);
    const payload: WorkoutInput = {
      date: defaultDate,
      dayCode: day.code,
      week: defaultWeek,
      block: defaultBlock,
      elbowPain: elbow,
      lowerBack: back,
      notes: null,
      entries: entries.map((e) => ({
        exercise: e.name,
        category: e.category,
        isSkill: e.isSkill,
        lever: e.lever || null,
        maxHold: e.isSkill && e.holds.length ? Math.max(...e.holds) : null,
        sets: e.isSkill ? e.holds.length || null : e.setsDone || null,
        repsOrTime: e.isSkill && e.holds.length ? e.holds.join("/") + "s" : null,
        rir: null,
        done: e.done,
        notes: null,
      })),
    };
    try {
      const { id } = await saveWorkout(payload);
      beep();
      setSavedId(id);
    } catch {
      setSaving(false);
    }
  }

  // comando de voz: "vai" inicia o hold, "parar" para e registra
  const vc = useVoiceCommands({
    enabled: voice && savedId === null && !isSummary && !!cur?.isSkill,
    isRunning: holdRunning,
    onStart: () => {
      if (!holdRunning) startHold();
    },
    onStop: () => {
      if (holdRunning) stopHold();
    },
  });

  // ---------- TELA CONCLUÍDO ----------
  if (savedId !== null) {
    return (
      <div className="px-[18px] pt-14">
        <div className="animate-pop pt-10 text-center">
          <div
            className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-2 border-accent"
            style={{ background: "rgba(214,251,61,.14)", boxShadow: "0 0 40px rgba(214,251,61,.35)" }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="#D6FB3D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="mt-[18px] font-display text-[34px] leading-none">TREINO SALVO</div>
          <div className="mt-1.5 text-[13px] text-muted">
            {doneCount}/{total} exercícios · {fmt(elapsed)} de treino 🔥
          </div>
          <button
            onClick={() => router.push(`/historico/${savedId}`)}
            className="btn-lime mx-auto mt-6 flex h-[50px] w-full max-w-[240px]"
          >
            <span className="text-[15px]">VER TREINO</span>
          </button>
          <button
            onClick={() => router.push("/")}
            className="btn-dark mx-auto mt-2.5 flex h-[50px] w-full max-w-[240px] text-[15px]"
          >
            FECHAR
          </button>
        </div>
      </div>
    );
  }

  // ---------- RESUMO ----------
  if (isSummary) {
    return (
      <div className="px-[18px] pb-28 pt-14">
        <div className="animate-fadeUp">
          <div className="font-display text-[30px] leading-none">COMO FOI?</div>
          <div className="mt-1 text-xs text-muted">
            {doneCount}/{total} feitos · {fmt(elapsed)} de treino
          </div>
          <div className="card mt-[18px]">
            <div className="label">Dor — cotovelo</div>
            <PainScale value={elbow} onSet={setElbow} />
            <div className="label mt-4">Dor — lombar</div>
            <PainScale value={back} onSet={setBack} />
          </div>
          <button onClick={save} disabled={saving} className="btn-lime mt-4 flex h-14 w-full">
            <span className="text-[20px]">{saving ? "SALVANDO..." : "✓ SALVAR TREINO"}</span>
          </button>
          <button
            onClick={() => setStep(total - 1)}
            className="mt-2.5 w-full text-center font-mono text-[11px] text-muted-2"
          >
            ← voltar aos exercícios
          </button>
        </div>
      </div>
    );
  }

  // ---------- PLAYER ----------
  const k = catOf(cur!.category);
  return (
    <div className="px-[18px] pb-28 pt-14">
      {/* header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-[10px] tracking-[0.18em] text-muted-2">
            {day.code} · EXERCÍCIO {step + 1}/{total}
          </div>
          <div className="mt-1 font-display text-[18px] leading-none">{doneCount} CONCLUÍDOS</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[9px] tracking-[0.18em] text-muted-2">TEMPO</div>
          <div className="font-mono text-[22px] font-bold text-accent">{fmt(elapsed)}</div>
        </div>
      </div>

      {/* segments */}
      <div className="mt-3 flex gap-[3px]">
        {entries.map((e, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-[2px]"
            style={{
              background:
                i < step || e.done ? "#D6FB3D" : i === step ? "rgba(214,251,61,0.4)" : "rgba(255,255,255,0.1)",
            }}
          />
        ))}
      </div>

      {/* rest */}
      {rest !== null && (
        <div
          className="mt-3.5 flex animate-restThrob items-center justify-between gap-2.5 rounded-[14px] px-4 py-3"
          style={{ background: "rgba(255,68,56,.12)", border: "1px solid rgba(255,68,56,.3)" }}
        >
          <span className="font-mono text-[10px] tracking-[0.2em] text-danger-soft">DESCANSO</span>
          <span className="font-mono text-[26px] font-bold text-danger-soft">{fmt(rest)}</span>
          <div className="flex gap-1.5">
            <button onClick={() => setRest((r) => (r ?? 0) + 15)} className="rounded-lg bg-white/[0.08] px-2.5 py-1.5 font-mono text-[11px]">
              +15
            </button>
            <button onClick={() => setRest(null)} className="rounded-lg bg-white/[0.08] px-2.5 py-1.5 font-mono text-[11px]">
              SKIP
            </button>
          </div>
        </div>
      )}

      {/* exercise card */}
      <div className="mt-3.5 rounded-[18px] border border-white/[0.07] bg-surface p-[18px]">
        <span className="chip-mono rounded-md px-1.5 py-1" style={{ color: k.color, background: k.bg }}>
          {k.label}
        </span>
        <div className="mt-2.5 font-display text-[23px] leading-[1.05]">{cur!.name}</div>
        <div className="mt-1.5 font-mono text-[11px] text-muted">{cur!.prescription}</div>

        {cur!.isSkill ? (
          <>
            {cur!.lever !== undefined && (
              <input
                value={cur!.lever}
                onChange={(e) => update(step, { lever: e.target.value })}
                placeholder="alavanca · ex: FL straddle"
                className="input mt-3.5"
              />
            )}
            <div className="mt-3 rounded-[16px] border border-white/[0.06] bg-bg px-4 py-5 text-center">
              <div className="font-mono text-[9px] tracking-[0.3em] text-muted-2">MAX-HOLD</div>
              <div
                className="mt-1.5 font-display text-[66px] leading-[0.9]"
                style={{ color: holdRunning ? "#D6FB3D" : "#F4F4F0" }}
              >
                {(holdMs / 1000).toFixed(1)}
                <span className="text-[26px] text-muted-2">s</span>
              </div>
              {holdRunning ? (
                <button
                  onClick={stopHold}
                  className="mt-3.5 flex h-[50px] w-full items-center justify-center gap-2 rounded-[13px] bg-danger font-display text-[17px] text-white"
                >
                  <span className="h-3 w-3 rounded-[2px] bg-white" /> PARAR & REGISTRAR
                </button>
              ) : (
                <button
                  onClick={startHold}
                  className="btn-lime mt-3.5 flex h-[50px] w-full animate-holdGlow"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8V4z" fill="#0A0A0C" /></svg>
                  <span className="text-[17px]">INICIAR HOLD</span>
                </button>
              )}

              {/* modo voz */}
              {vc.supported ? (
                <div className="mt-3.5 border-t border-white/[0.06] pt-3.5">
                  <button
                    onClick={() => setVoice((v) => !v)}
                    className="flex w-full items-center justify-center gap-2 rounded-[12px] py-2.5 font-mono text-[11px] tracking-[0.12em]"
                    style={
                      voice
                        ? { background: "rgba(214,251,61,0.14)", color: "#D6FB3D", border: "1px solid rgba(214,251,61,0.4)" }
                        : { background: "rgba(255,255,255,0.05)", color: "#9A9AA4", border: "1px solid rgba(255,255,255,0.08)" }
                    }
                  >
                    🎤 {voice ? "MODO VOZ ATIVO" : "ATIVAR MODO VOZ"}
                  </button>
                  {voice && (
                    <div className="mt-2.5">
                      <div className="flex items-center justify-center gap-2 font-mono text-[10px] text-muted">
                        <span
                          className={`h-2 w-2 rounded-full ${vc.listening ? "animate-restThrob bg-danger" : "bg-muted-2"}`}
                        />
                        {vc.listening ? "ouvindo…" : "ativando microfone…"}
                      </div>
                      <div className="mt-1.5 text-center font-mono text-[10px] leading-relaxed text-muted-2">
                        diga <span className="text-accent">“VAI”</span> p/ iniciar ·{" "}
                        <span className="text-danger-soft">“PARAR”</span> p/ registrar
                      </div>
                      {vc.heard && (
                        <div className="mt-1 text-center font-mono text-[10px] italic text-muted-3">
                          “{vc.heard}”
                        </div>
                      )}
                    </div>
                  )}
                  {vc.error && (
                    <div className="mt-2 text-center font-mono text-[10px] text-danger-soft">{vc.error}</div>
                  )}
                </div>
              ) : (
                <div className="mt-3 text-center font-mono text-[9px] text-muted-3">
                  voz não suportada neste navegador
                </div>
              )}
            </div>
            {cur!.holds.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 font-mono text-[9px] tracking-[0.16em] text-muted-2">
                  SÉRIES · MAX {Math.max(...cur!.holds)}s
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {cur!.holds.map((h, i) => (
                    <span
                      key={i}
                      className="rounded-lg px-2.5 py-1.5 font-mono text-xs"
                      style={{ background: "rgba(214,251,61,.14)", color: "#D6FB3D" }}
                    >
                      {h}s
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="mt-3.5 rounded-[16px] border border-white/[0.06] bg-bg p-[18px] text-center">
            <div className="font-mono text-[9px] tracking-[0.3em] text-muted-2">SÉRIES FEITAS</div>
            <div className="my-1 font-display text-[60px] leading-[0.9]">{cur!.setsDone}</div>
            <div className="flex justify-center gap-3.5">
              <button
                onClick={subSet}
                className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.06] text-[26px] text-muted"
              >
                –
              </button>
              <button
                onClick={addSet}
                className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-accent text-[26px] text-bg"
                style={{ boxShadow: "0 0 20px rgba(214,251,61,.3)" }}
              >
                +
              </button>
            </div>
            <div className="mt-2.5 font-mono text-[9px] text-muted-2">+1 SÉRIE INICIA O DESCANSO</div>
          </div>
        )}
      </div>

      {/* nav */}
      <div className="mt-3.5 flex gap-2.5">
        <button onClick={prev} disabled={step === 0} className="btn-dark h-[50px] flex-1 text-[15px] disabled:opacity-40">
          ← ANTERIOR
        </button>
        <button onClick={next} className="btn-lime h-[50px] flex-1 text-[15px]">
          {step === total - 1 ? "FINALIZAR →" : "PRÓXIMO →"}
        </button>
      </div>
    </div>
  );
}

function PainScale({ value, onSet }: { value: number | null; onSet: (n: number) => void }) {
  return (
    <div className="mt-2.5 flex gap-1.5">
      {Array.from({ length: 11 }).map((_, n) => {
        const sel = value === n;
        const bg = sel ? (n >= 3 ? "#FF4438" : n > 0 ? "#FFC14D" : "#D6FB3D") : "rgba(255,255,255,0.05)";
        return (
          <button
            key={n}
            onClick={() => onSet(n)}
            className="flex h-[38px] flex-1 items-center justify-center rounded-[9px] font-mono text-[13px]"
            style={{ background: bg, color: sel ? "#0A0A0C" : "#6E6E78" }}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
