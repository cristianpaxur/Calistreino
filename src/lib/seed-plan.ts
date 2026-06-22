// Seed: converte a constante PLAN (src/lib/plan.ts) em um ProgramDraft inserível.
// Função PURA (sem IO) → testável offline (scripts/verify-seed.ts).
// A inserção real no banco fica em src/lib/programs.ts::insertProgramDraft
// (chamada por scripts/seed-program.ts, que é portão humano).

import {
  PLAN,
  FL_PROGRESSION,
  PLANCHE_PROGRESSION,
  type PlanDay,
  type PlanExercise,
} from "./plan.ts";
import type {
  ProgramDraft,
  ProgramDraftDay,
  DayExerciseInsert,
  TargetUnit,
} from "./program-types.ts";

export const SEED_PROGRAM_NAME = "Retorno FL + Planche";
export const SEED_ARCHETYPE = "fl-planche";
export const SEED_CYCLE_WEEKS = 12;

// Skills isométricas medem segundos; o resto, reps. (Heurística do PLAN.)
function unitFor(ex: PlanExercise): TargetUnit {
  return ex.isSkill ? "seconds" : "reps";
}

function exerciseToDraft(ex: PlanExercise, position: number): DayExerciseInsert {
  return {
    exercise_id: null, // seed usa nome livre; a curadoria (005) liga aos slugs depois
    exercise_name: ex.name,
    is_skill: !!ex.isSkill,
    prescription: ex.prescription,
    target_unit: unitFor(ex),
    target_min: null,
    target_max: null,
    rest_seconds: null,
    position,
    note: ex.note ?? null,
  };
}

function dayToDraft(day: PlanDay, position: number): ProgramDraftDay {
  return {
    code: day.code,
    weekday: day.weekday,
    title: day.title,
    focus: day.focus,
    character: day.character,
    position,
    exercises: day.exercises.map((ex, i) => exerciseToDraft(ex, i)),
  };
}

/** PLAN → ProgramDraft (programa + dias + exercícios), pronto para inserir. */
export function planToProgramDraft(): ProgramDraft {
  return {
    name: SEED_PROGRAM_NAME,
    archetype: SEED_ARCHETYPE,
    source: "seed",
    cycle_weeks: SEED_CYCLE_WEEKS,
    active: true,
    days: PLAN.map((d, i) => dayToDraft(d, i)),
  };
}

// As escadas de skill que acompanham o seed (viram skills + skill_levels).
export interface SkillLadderSeed {
  slug: string;
  name: string;
  levels: string[]; // ordenado: índice = position
}

export function planToSkillLadders(): SkillLadderSeed[] {
  return [
    { slug: "front-lever", name: "Front Lever", levels: FL_PROGRESSION },
    { slug: "planche", name: "Planche", levels: PLANCHE_PROGRESSION },
  ];
}
