// Lógica PURA do builder de rotina (006). Sem IO → testável offline
// (scripts/verify-routine.ts). A server action saveRoutine só faz o IO (insert)
// depois de validar/normalizar aqui.

import type { ProgramDraft } from "./program-types";

export interface RoutineExerciseInput {
  exerciseId?: string | null; // FK da biblioteca; null => nome livre
  name: string;
  isSkill: boolean;
  prescription?: string | null;
  targetUnit?: "reps" | "seconds";
  targetMin?: number | null;
  targetMax?: number | null;
  restSeconds?: number | null;
  note?: string | null;
}
export interface RoutineDayInput {
  code?: string;
  title?: string;
  focus?: string | null;
  character?: string | null;
  exercises: RoutineExerciseInput[];
}
export interface RoutineInput {
  name: string;
  days: RoutineDayInput[];
  activate?: boolean;
}

export type RoutineResult =
  | { ok: true; draft: ProgramDraft & { active: boolean } }
  | { ok: false; error: string };

/** Valida e normaliza a entrada do builder num ProgramDraft pronto para inserir.
 *  Regras (CA-001 / casos de borda): nome obrigatório; ≥1 dia com ≥1 exercício;
 *  exercícios sem nome são descartados; dias sem exercício são descartados. */
export function buildRoutineDraft(input: RoutineInput): RoutineResult {
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "Dê um nome à rotina." };

  const days = (input.days ?? [])
    .map((d) => ({
      ...d,
      exercises: (d.exercises ?? []).filter((e) => (e.name ?? "").trim()),
    }))
    .filter((d) => d.exercises.length > 0);

  if (!days.length) {
    return { ok: false, error: "Adicione ao menos um exercício a um dia." };
  }

  const draft: ProgramDraft & { active: boolean } = {
    name,
    source: "manual",
    active: !!input.activate,
    days: days.map((d, di) => ({
      code: (d.code ?? "").trim() || `D${di + 1}`,
      title: (d.title ?? "").trim() || `Dia ${di + 1}`,
      focus: d.focus ?? null,
      character: d.character ?? null,
      position: di,
      exercises: d.exercises.map((e, ei) => ({
        exercise_id: e.exerciseId ?? null,
        // mantém o nome sempre (o adaptador 004 exibe por exercise_name)
        exercise_name: e.name.trim(),
        is_skill: e.isSkill,
        prescription: (e.prescription ?? "").trim() || null,
        target_unit: e.targetUnit ?? (e.isSkill ? "seconds" : "reps"),
        target_min: e.targetMin ?? null,
        target_max: e.targetMax ?? null,
        rest_seconds: e.restSeconds ?? null,
        position: ei,
        note: (e.note ?? "").trim() || null,
      })),
    })),
  };

  return { ok: true, draft };
}
