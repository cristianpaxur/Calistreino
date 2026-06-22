// Tipos do domínio de plano (003). Espelham as tabelas da migração 003.
// Este modelo é o contrato que a IA (008) preenche e o builder (006) edita.

export type TargetUnit = "reps" | "seconds";
export type ProgramSource = "seed" | "ai" | "manual";

// ── Biblioteca de exercícios ─────────────────────────────────────────
export interface LibraryExercise {
  id: string;
  slug: string;
  name: string;
  category: string | null; // skill | forca | core | pernas
  pattern: string | null; // front | planche | push | pull | legs | core ...
  is_skill: boolean;
  default_unit: TargetUnit;
  equipment: string[];
  cues: string | null;
  demo_url: string | null;
  owner_user_id: string | null; // null = global
  created_at: string;
}

// ── Skills + escadas ─────────────────────────────────────────────────
export interface Skill {
  id: string;
  slug: string;
  name: string;
  owner_user_id: string | null;
  created_at: string;
}

export interface SkillLevel {
  id: string;
  skill_id: string;
  position: number; // 0 = mais fácil
  name: string;
  created_at: string;
}

export interface SkillWithLadder extends Skill {
  levels: SkillLevel[];
}

// ── Programa → Dia → Exercício ───────────────────────────────────────
export interface Program {
  id: string;
  user_id: string;
  name: string;
  archetype: string | null;
  source: ProgramSource;
  cycle_weeks: number | null;
  active: boolean;
  /** Auditoria 008 (geração por IA): templateId/model/inputProfileHash/origin… */
  meta: ProgramMeta | null;
  created_at: string;
}

/** Trilha de auditoria de um programa gerado (008). */
export interface ProgramMeta {
  templateId?: string;
  model?: string;
  inputProfileHash?: string;
  origin?: "ai" | "fallback";
  attempts?: number;
  /** Resumos das issues que o validador ajustou/sinalizou. */
  issues?: string[];
  [key: string]: unknown;
}

export interface ProgramDay {
  id: string;
  program_id: string;
  user_id: string;
  code: string; // D1..D5
  weekday: string | null;
  title: string;
  focus: string | null;
  character: string | null;
  position: number;
  created_at: string;
}

export interface DayExercise {
  id: string;
  program_day_id: string;
  user_id: string;
  exercise_id: string | null; // da biblioteca; null => nome livre
  exercise_name: string | null;
  is_skill: boolean;
  prescription: string | null;
  target_unit: TargetUnit;
  target_min: number | null;
  target_max: number | null;
  rest_seconds: number | null;
  position: number;
  note: string | null;
  created_at: string;
}

// ── Agregados de leitura ─────────────────────────────────────────────
export interface ProgramDayWithExercises extends ProgramDay {
  exercises: DayExercise[];
}

export interface ProgramView extends Program {
  days: ProgramDayWithExercises[];
}

// ── Shapes de inserção (sem id/created_at; user_id via default auth.uid()) ──
export interface ProgramInsert {
  name: string;
  archetype?: string | null;
  source?: ProgramSource;
  cycle_weeks?: number | null;
  active?: boolean;
  meta?: ProgramMeta | null;
}

export interface ProgramDayInsert {
  code: string;
  weekday?: string | null;
  title: string;
  focus?: string | null;
  character?: string | null;
  position?: number;
}

export interface DayExerciseInsert {
  exercise_id?: string | null;
  exercise_name?: string | null;
  is_skill?: boolean;
  prescription?: string | null;
  target_unit?: TargetUnit;
  target_min?: number | null;
  target_max?: number | null;
  rest_seconds?: number | null;
  position?: number;
  note?: string | null;
}

// Estrutura "pura" usada pelo seed/IA antes de tocar o banco: um programa
// completo aninhado (dias com exercícios). Mapeia 1:1 para os inserts acima.
export interface ProgramDraftDay extends ProgramDayInsert {
  exercises: DayExerciseInsert[];
}

export interface ProgramDraft extends ProgramInsert {
  days: ProgramDraftDay[];
}
