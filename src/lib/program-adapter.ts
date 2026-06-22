// Adaptador PURO (sem IO): converte o modelo de banco (003) no shape `PlanDay`
// que o runtime já consome (WorkoutPlayer, SessionForm, telas). Manter este
// contrato é o que evita reescrever a parte polida do app (timers/voz/escala).
//
// Testável offline: scripts/verify-adapter.ts roda sem rede, comparando o
// programa-modelo (PLAN → ProgramDraft) re-adaptado contra o PLAN original.

import type { Category, PlanDay, PlanExercise, CycleWeek } from "./plan";
import type {
  DayExercise,
  ProgramDayWithExercises,
  ProgramView,
  SkillWithLadder,
} from "./program-types";

// Categorias conhecidas do runtime; fora disso cai em "forca" (neutro).
const KNOWN_CATEGORIES: Category[] = ["skill", "forca", "core", "pernas"];

function asCategory(value: string | null): Category {
  if (value && (KNOWN_CATEGORIES as string[]).includes(value)) {
    return value as Category;
  }
  return "forca";
}

/** Nome de exibição de um exercício do dia (biblioteca via join OU nome livre). */
export function exerciseDisplayName(ex: DayExercise): string {
  return (ex.exercise_name ?? "").trim() || "Exercício";
}

/** day_exercise (banco) → PlanExercise (runtime). */
export function adaptExercise(ex: DayExercise): PlanExercise {
  return {
    name: exerciseDisplayName(ex),
    category: ex.is_skill ? "skill" : asCategory(null),
    prescription: ex.prescription ?? "",
    note: ex.note ?? undefined,
    isSkill: ex.is_skill,
  };
}

/** program_day + exercícios (banco) → PlanDay (runtime). */
export function adaptDay(day: ProgramDayWithExercises): PlanDay {
  return {
    code: day.code,
    weekday: day.weekday ?? "",
    title: day.title,
    focus: day.focus ?? day.title,
    character: day.character ?? "",
    exercises: day.exercises.map(adaptExercise),
  };
}

/** ProgramView (banco) → PlanDay[] (runtime), na ordem de `position`. */
export function adaptProgram(program: ProgramView): PlanDay[] {
  return program.days.map(adaptDay);
}

/** Escada do skill (skills + skill_levels) → array ordenado de nomes de níveis. */
export function adaptLadder(skill: SkillWithLadder): string[] {
  return [...skill.levels]
    .sort((a, b) => a.position - b.position)
    .map((l) => l.name);
}

// ── Metadados de FK p/ salvar a sessão vinculada ao programa (T-006) ──────
// O player conhece o exercício pelo `code` do dia + nome do exercício; o save
// precisa traduzir isso para program_day_id / day_exercise_id.

export interface DayExerciseRef {
  programDayId: string;
  dayExerciseId: string;
}

/** Mapa (dayCode → (exerciseName → ids)) p/ resolver FKs ao salvar. */
export function buildExerciseRefMap(
  program: ProgramView
): Map<string, Map<string, DayExerciseRef>> {
  const byDay = new Map<string, Map<string, DayExerciseRef>>();
  for (const day of program.days) {
    const byName = new Map<string, DayExerciseRef>();
    for (const ex of day.exercises) {
      byName.set(exerciseDisplayName(ex), {
        programDayId: day.id,
        dayExerciseId: ex.id,
      });
    }
    byDay.set(day.code, byName);
  }
  return byDay;
}

// ── Periodização ──────────────────────────────────────────────────────────
// O modelo 003 não materializa a periodização semana-a-semana (só `cycle_weeks`).
// Enquanto a periodização-como-dado não existir, o runtime reusa a constante
// PERIODIZATION da semente. Este ponto fica centralizado aqui para troca futura.
export type { CycleWeek };
