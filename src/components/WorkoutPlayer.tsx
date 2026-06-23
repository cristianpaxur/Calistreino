"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanDay, PlanExercise } from "@/lib/plan";
import { saveWorkout, type WorkoutInput } from "@/app/actions";
import { catOf, MovementChip } from "@/components/ui";
import { useVoiceCommands, speak } from "@/components/useVoiceCommands";
import ExercisePicker from "@/components/ExercisePicker";
import type { ExerciseOption } from "@/lib/exercise-catalog";
import {
  type SessionDraft,
  type SessionEntry,
  sessionKey,
  loadDraft,
  saveDraft,
  clearDraft,
  elapsedFrom,
  DRAFT_VERSION,
} from "@/lib/session-draft";
import { isStatic as classifyStatic } from "@/lib/exercise-classify";

// 013: o estado de cada entry do player É o `SessionEntry` do draft (mesmo shape
// serializável), agora carregando `unit`/`isStatic`. Aliasamos o nome `EntryState`
// que o resto do componente já usa para não tocar em cada referência.
type EntryState = SessionEntry;

function fromPlan(ex: PlanExercise): EntryState {
  // 013: o `PlanExercise` não expõe unidade-alvo, então derivamos a unidade da
  // heurística de skill (isométrico de skill = hold/segundos) e classificamos o
  // eixo de movimento por `isStatic` — fonte única da decisão estático×dinâmico.
  const unit: "reps" | "seconds" = ex.isSkill ? "seconds" : "reps";
  return {
    name: ex.name,
    category: ex.category,
    isSkill: !!ex.isSkill,
    unit,
    isStatic: classifyStatic({ unit, isSkill: !!ex.isSkill }),
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

function fromOption(o: ExerciseOption): EntryState {
  // 013: a opção do catálogo já traz `defaultUnit` ("seconds"/"reps") — a fonte
  // mais específica disponível aqui. `isStatic` deriva dela (com fallback isSkill).
  const unit = o.defaultUnit;
  return {
    name: o.name,
    category: o.category,
    isSkill: o.isSkill,
    unit,
    isStatic: classifyStatic({ defaultUnit: unit, isSkill: o.isSkill }),
    prescription: "",
    lever: "",
    holds: [],
    setsDone: 0,
    done: false,
  };
}

export default function WorkoutPlayer({
  day,
  defaultDate,
  defaultWeek,
  defaultBlock,
  suggestedLevers,
  programDayId = null,
  exerciseRefs = {},
  freestyle = false,
  catalog = [],
}: {
  day: PlanDay;
  defaultDate: string;
  defaultWeek: number;
  defaultBlock: string;
  suggestedLevers: { front: string | null; planche: string | null };
  programDayId?: string | null;
  /** nome do exercício → day_exercise_id (vínculo com o programa, 004). */
  exerciseRefs?: Record<string, string>;
  /** 006: sessão avulsa — começa vazio e adiciona exercícios em runtime. */
  freestyle?: boolean;
  /** catálogo p/ o picker da sessão avulsa (biblioteca real ou fallback PLAN). */
  catalog?: ExerciseOption[];
}) {
  const router = useRouter();

  // 011: chave estável da sessão — mesma sessão lógica sempre gera a mesma string,
  // p/ rehidratar o draft certo e a barra de retomada saber qual treino oferecer.
  // `useMemo` p/ não recalcular a cada render (deps são props estáveis).
  const key = useMemo(
    () => sessionKey({ programDayId, dayCode: day.code, freestyle }),
    [programDayId, day.code, freestyle]
  );

  // 011: inicialização das entries a partir do `day` (comportamento atual) —
  // extraída p/ função pura porque também é o fallback quando NÃO há draft.
  const buildInitialEntries = (): EntryState[] =>
    day.exercises.map((ex) => {
      const e = fromPlan(ex);
      if (e.isSkill) {
        const n = e.name.toLowerCase();
        if (n.includes("front") || n.includes("fl")) e.lever = suggestedLevers.front ?? "";
        else if (n.includes("planche")) e.lever = suggestedLevers.planche ?? "";
      }
      return e;
    });

  // 011: rehidratação no mount. `useState(initializer)` roda UMA vez no cliente.
  // Se houver draft compatível (mesma chave/versão, validado em loadDraft), retoma
  // entries/step/relógio; senão inicializa do `day`. Tolerante a localStorage
  // ausente (loadDraft devolve null → cai no fallback). O `startedAt`/`accumulatedMs`
  // ficam em ref (relógio resiliente, não dispara re-render).
  const startedAt = useRef(0);
  const accumulatedMs = useRef(0);
  // 011: instante em que o cronômetro congela ao salvar — p/ a tela "TREINO SALVO"
  // exibir o tempo final estável (não depende de ticks que já pararam).
  const frozenAt = useRef(0);
  const [hydrated, setHydrated] = useState(false);

  // Lê o draft UMA vez no mount (ref via useState-initializer p/ não reler em cada
  // render). `usable` = draft compatível com entries (ou freestyle vazio válido).
  const initialDraft = useRef<SessionDraft | null>(null);
  const draftRead = useRef(false);
  if (!draftRead.current) {
    draftRead.current = true;
    const d = loadDraft(key);
    initialDraft.current = d && (d.entries.length > 0 || freestyle) ? d : null;
  }

  const [entries, setEntries] = useState<EntryState[]>(() => {
    const draft = initialDraft.current;
    if (draft) {
      startedAt.current = draft.startedAt;
      accumulatedMs.current = draft.accumulatedMs;
      return draft.entries;
    }
    // sem draft: relógio começa agora; entries do dia.
    startedAt.current = Date.now();
    accumulatedMs.current = 0;
    return buildInitialEntries();
  });
  const [picking, setPicking] = useState(false);
  const total = entries.length;
  const [step, setStep] = useState<number>(() => initialDraft.current?.step ?? 0);

  // marca que o mount/rehidratação terminou — o autosave só liga depois disso p/
  // não regravar o draft com o estado inicial antes de o usuário tocar em nada.
  useEffect(() => {
    setHydrated(true);
  }, []);
  // Em sessão avulsa, com 0 exercícios mostramos a tela inicial (não o resumo).
  const isEmpty = freestyle && total === 0;
  const isSummary = !isEmpty && step >= total;

  const addExercise = (o: ExerciseOption) => {
    setStep(entries.length); // salta para o exercício recém-adicionado
    setEntries((prev) => [...prev, fromOption(o)]);
    setPicking(false);
  };

  const [rest, setRest] = useState<number | null>(null);
  const [holdRunning, setHoldRunning] = useState(false);
  const [holdMs, setHoldMs] = useState(0);
  const holdStart = useRef(0);

  const [elbow, setElbow] = useState<number | null>(null);
  const [back, setBack] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [voice, setVoice] = useState(false);
  // 012: feedback visual de "ouvi 'parar'" — pisca quando a voz dispara o stop.
  const [stopHeard, setStopHeard] = useState(false);

  // 011: o cronômetro `elapsed` deixa de ser um contador em memória e passa a ser
  // DERIVADO de timestamps (`startedAt`/`accumulatedMs`), resiliente a reload. O
  // tick de 1s existe só p/ forçar o re-render que reexibe o valor derivado; uma
  // vez salvo (savedId), congela. `tick` é só um "carimbo" de tempo p/ recalcular.
  const [tick, setTick] = useState(() => Date.now());
  // `elapsedFrom` só lê `accumulatedMs`/`startedAt`; passamos um draft mínimo com
  // esses campos (Pick) — sem `as any`, sem montar o objeto inteiro a cada render.
  const clock: Pick<SessionDraft, "accumulatedMs" | "startedAt"> = {
    accumulatedMs: accumulatedMs.current,
    startedAt: startedAt.current,
  };
  const elapsed = elapsedFrom(clock as SessionDraft, savedId === null ? tick : frozenAt.current);

  useEffect(() => {
    const id = setInterval(() => {
      if (savedId === null) setTick(Date.now());
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

  // 011: AUTOSAVE debounced (~500ms). Reescreve o draft a cada mudança de
  // `entries`/`step` (RNF-003: não a cada keystroke). Só roda após a rehidratação
  // (`hydrated`) e enquanto não salvo (savedId === null) — depois disso o draft já
  // foi limpo e não deve ser recriado. Tolerante a localStorage ausente: saveDraft
  // é no-op nesse caso. Persistimos o relógio por timestamp p/ sobreviver a reload.
  useEffect(() => {
    if (!hydrated || savedId !== null) return;
    const id = setTimeout(() => {
      const draft: SessionDraft = {
        v: DRAFT_VERSION,
        key,
        dayCode: day.code,
        programDayId,
        freestyle,
        entries,
        step,
        startedAt: startedAt.current,
        accumulatedMs: accumulatedMs.current,
        updatedAt: Date.now(),
      };
      saveDraft(draft);
    }, 500);
    return () => clearTimeout(id);
  }, [entries, step, hydrated, savedId, key, day.code, programDayId, freestyle]);

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
    // 013: descanso por papel — skill descansa mais (120s) que isométrico de core.
    setRest(cur?.isSkill ? 120 : 90);
    // 012: serializa a confirmação por voz — só fala APÓS registrar (e só no modo
    // voz) p/ não disputar o canal HFP/Bluetooth com a escuta. Mostra feedback
    // visual "ouvi 'parar'" por ~1,5s.
    if (voice) {
      setStopHeard(true);
      window.setTimeout(() => setStopHeard(false), 1500);
      speak(`${secs} ${secs === 1 ? "segundo" : "segundos"}`);
    }
  };
  const addSet = () => {
    update(step, { setsDone: (cur?.setsDone ?? 0) + 1, done: true });
    setRest(90);
  };
  const subSet = () => update(step, { setsDone: Math.max(0, (cur?.setsDone ?? 0) - 1) });

  // 011 (RF-004/005): edição/exclusão de um hold já registrado. Toca no chip →
  // prompt p/ novo valor (segundos); vazio ou 0 exclui. Como max/total derivam de
  // `holds`, recalculam sozinhos. Tolerante a ambientes sem `prompt` (no-op).
  const editHold = (i: number) => {
    if (typeof window === "undefined" || typeof window.prompt !== "function") return;
    const curHolds = entries[step].holds;
    const resp = window.prompt("Editar hold (segundos) — vazio ou 0 exclui", String(curHolds[i]));
    if (resp === null) return; // cancelou
    const parsed = Math.round(Number(resp.replace(",", ".")));
    const nextHolds =
      !resp.trim() || !Number.isFinite(parsed) || parsed <= 0
        ? curHolds.filter((_, j) => j !== i)
        : curHolds.map((h, j) => (j === i ? parsed : h));
    update(step, { holds: nextHolds, done: nextHolds.length > 0 ? entries[step].done : false });
  };
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
      programDayId,
      entries: entries.map((e) => ({
        exercise: e.name,
        category: e.category,
        isSkill: e.isSkill,
        lever: e.lever || null,
        // 013: a decisão "registrar hold × registrar séries" passa a ser pelo eixo
        // de movimento (`isStatic`), não mais por `isSkill` — assim isométricos
        // não-skill (hollow hold) gravam max-hold/tempo, não contagem de séries.
        maxHold: e.isStatic && e.holds.length ? Math.max(...e.holds) : null,
        sets: e.isStatic ? e.holds.length || null : e.setsDone || null,
        repsOrTime: e.isStatic && e.holds.length ? e.holds.join("/") + "s" : null,
        rir: null,
        done: e.done,
        notes: null,
        dayExerciseId: exerciseRefs[e.name] ?? null,
      })),
    };
    try {
      const { id } = await saveWorkout(payload);
      beep();
      frozenAt.current = Date.now(); // 011: congela o cronômetro no instante do save
      // 011 (RF-006): treino salvo → limpa o draft p/ não reaparecer na retomada.
      clearDraft(key);
      setSavedId(id);
    } catch {
      setSaving(false);
    }
  }

  // 011 (RF-002): minimizar — sai do player mantendo o draft (a barra de retomada
  // reaparece na home). O autosave já persistiu o estado; só navegamos.
  const minimize = () => {
    router.push("/");
  };

  // 011 (RF-006): descartar explicitamente — confirma, limpa o draft e volta à home.
  const discard = () => {
    if (typeof window !== "undefined" && typeof window.confirm === "function") {
      if (!window.confirm("Descartar este treino? O progresso não salvo será perdido.")) return;
    }
    clearDraft(key);
    router.push("/");
  };

  // comando de voz: "vai" inicia o hold, "parar" para e registra
  const vc = useVoiceCommands({
    // 013: voz habilitada para QUALQUER exercício estático (não só skills) — é o
    // modo cronômetro de hold que usa "vai"/"parar".
    // 012: durante o feedback de confirmação (stopHeard) suspendemos a escuta p/
    // o TTS não competir com o microfone (HFP/Bluetooth) — serialização.
    enabled: voice && savedId === null && !isSummary && !!cur?.isStatic && !stopHeard,
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

  // ---------- SESSÃO AVULSA: VAZIA ----------
  if (isEmpty) {
    return (
      <>
        <div className="px-[18px] pb-28 pt-14">
          <div className="animate-fadeUp text-center">
            <div className="font-mono text-[10px] tracking-[0.22em] text-accent">
              SESSÃO AVULSA · {fmt(elapsed)}
            </div>
            <div className="mt-2 font-display text-[32px] leading-none">TREINO DE HOJE</div>
            <p className="mx-auto mt-3 max-w-[280px] text-[13px] leading-relaxed text-muted">
              Comece vazio e adicione exercícios na hora — da biblioteca ou
              criando o seu. Tudo grava no histórico como qualquer treino.
            </p>
            <button
              onClick={() => setPicking(true)}
              className="btn-lime mx-auto mt-6 flex h-[52px] w-full max-w-[260px] text-[16px]"
            >
              + ADICIONAR EXERCÍCIO
            </button>
            <button
              onClick={() => router.push("/")}
              className="mx-auto mt-2.5 block font-mono text-[11px] text-muted-2"
            >
              cancelar
            </button>
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

  // ---------- RESUMO ----------
  if (isSummary) {
    return (
      <>
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
            {freestyle && (
              <button
                onClick={() => setPicking(true)}
                className="btn-dark mt-3 flex h-[48px] w-full text-[14px]"
              >
                + ADICIONAR OUTRO EXERCÍCIO
              </button>
            )}
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

  // ---------- PLAYER ----------
  const k = catOf(cur!.category);
  return (
    <>
    <div className="px-[18px] pb-28 pt-14">
      {/* header */}
      <div className="flex items-start justify-between">
        <div>
          {/* 011: MINIMIZAR — sai do player mantendo o draft (retomada via barra). */}
          <button
            onClick={minimize}
            className="mb-1.5 inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2 py-1 font-mono text-[9px] tracking-[0.16em] text-muted"
          >
            ↙ MINIMIZAR
          </button>
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
        {/* 013: categoria (cor/papel) + eixo de movimento (estático×dinâmico). */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="chip-mono rounded-md px-1.5 py-1" style={{ color: k.color, background: k.bg }}>
            {k.label}
          </span>
          <MovementChip type={cur!.isStatic ? "static" : "dynamic"} />
        </div>
        <div className="mt-2.5 font-display text-[23px] leading-[1.05]">{cur!.name}</div>
        <div className="mt-1.5 font-mono text-[11px] text-muted">{cur!.prescription}</div>

        {cur!.isStatic ? (
          <>
            {/* alavanca só faz sentido p/ skills (FL/Planche); ocultamos em estáticos de core. */}
            {cur!.isSkill && (
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
                  style={{ boxShadow: "0 0 22px rgba(255,68,56,.45)" }}
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

              {/* 012: feedback de voz — confirma que o comando de parada foi ouvido.
                  O botão acima é sempre o fallback imediato (RF-005). */}
              {stopHeard && (
                <div
                  className="mt-2.5 flex items-center justify-center gap-1.5 rounded-[11px] px-3 py-2 font-mono text-[10px] tracking-[0.14em]"
                  style={{ background: "rgba(214,251,61,0.14)", color: "#D6FB3D", border: "1px solid rgba(214,251,61,0.4)" }}
                >
                  ✓ OUVI “PARAR” · REGISTRADO
                </div>
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
                <div className="mb-1.5 flex items-center justify-between font-mono text-[9px] tracking-[0.16em] text-muted-2">
                  <span>
                    SÉRIES · MAX {Math.max(...cur!.holds)}s · TOTAL{" "}
                    {cur!.holds.reduce((a, b) => a + b, 0)}s
                  </span>
                  <span className="text-muted-3">toque p/ editar</span>
                </div>
                {/* 011 (RF-004/005): cada chip é tocável → edita/exclui o hold;
                    max/total recalculam automaticamente porque derivam de `holds`. */}
                <div className="flex flex-wrap gap-1.5">
                  {cur!.holds.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => editHold(i)}
                      className="rounded-lg px-2.5 py-1.5 font-mono text-xs"
                      style={{ background: "rgba(214,251,61,.14)", color: "#D6FB3D" }}
                    >
                      {h}s
                    </button>
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

      {freestyle && (
        <button
          onClick={() => setPicking(true)}
          className="mt-2.5 w-full text-center font-mono text-[11px] text-accent"
        >
          + adicionar exercício
        </button>
      )}

      {/* 011 (RF-006): descartar treino — confirma e limpa o draft. */}
      <button
        onClick={discard}
        className="mt-2.5 w-full text-center font-mono text-[11px] text-muted-3"
      >
        descartar treino
      </button>
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
