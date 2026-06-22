import { db } from "./db";
import type {
  LibraryExercise,
  Skill,
  SkillLevel,
  SkillWithLadder,
  Program,
  ProgramDay,
  DayExercise,
  ProgramView,
  ProgramDayWithExercises,
  ProgramInsert,
  ProgramDayInsert,
  DayExerciseInsert,
  ProgramDraft,
} from "./program-types";
import {
  adaptProgram,
  adaptLadder,
  buildExerciseRefMap,
  type DayExerciseRef,
} from "./program-adapter";
import {
  PLAN,
  PERIODIZATION,
  FL_PROGRESSION,
  PLANCHE_PROGRESSION,
  type PlanDay,
  type CycleWeek,
} from "./plan";
import {
  seedExerciseOptions,
  type ExerciseOption,
} from "./exercise-catalog";
import type {
  AnamneseProfile,
  HealthFlags,
  OnboardingPath,
} from "./anamnese";
import {
  generatePlan,
  profileHash,
  type SlugCatalog,
  type GenerateOptions,
} from "./plan-generator";
import { buildSeedCatalog } from "./plan-catalog";

// CRUD do modelo de programa/biblioteca (003). Tudo passa por `await db()`
// (anon key + sessão → RLS por auth.uid()); user_id é preenchido pelo default
// auth.uid() no banco. NUNCA service_role no runtime.

// ── Biblioteca de exercícios ─────────────────────────────────────────
export async function listLibrary(filter?: {
  pattern?: string;
  is_skill?: boolean;
}): Promise<LibraryExercise[]> {
  const sb = await db();
  let qb = sb.from("exercise_library").select("*").order("name", { ascending: true });
  if (filter?.pattern) qb = qb.eq("pattern", filter.pattern);
  if (filter?.is_skill !== undefined) qb = qb.eq("is_skill", filter.is_skill);
  const { data, error } = await qb;
  if (error) throw error;
  return (data ?? []) as LibraryExercise[];
}

export async function getLibraryBySlug(slug: string): Promise<LibraryExercise | null> {
  const sb = await db();
  const { data, error } = await sb
    .from("exercise_library")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as LibraryExercise | null;
}

/** Catálogo p/ o ExercisePicker (006): tenta a biblioteca real (005); se vier
 *  vazia ou a consulta falhar (migração não aplicada — R1/R9), cai nas opções
 *  derivadas do PLAN. Inclui também os customs do próprio usuário (RLS já filtra). */
export async function getExerciseCatalog(): Promise<ExerciseOption[]> {
  try {
    const lib = await listLibrary();
    if (!lib.length) return seedExerciseOptions();
    return lib
      .map((e) => ({
        id: e.id,
        slug: e.slug,
        name: e.name,
        category: (e.category ?? (e.is_skill ? "skill" : "forca")) as ExerciseOption["category"],
        isSkill: e.is_skill,
        defaultUnit: e.default_unit,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt"));
  } catch {
    return seedExerciseOptions();
  }
}

/** Cria (ou reutiliza) um exercício custom do usuário (006 / T-002). A coluna
 *  owner_user_id não tem default → preenchemos com o uid da sessão. Se já houver
 *  um slug igual do mesmo dono, reutiliza (idempotência → evita duplicar; CA-003). */
export async function createCustomExercise(input: {
  name: string;
  category?: string | null;
  isSkill?: boolean;
}): Promise<LibraryExercise> {
  const sb = await db();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sem sessão de usuário.");

  const name = input.name.trim();
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  // Reutiliza se já houver um custom do dono com o mesmo slug.
  const { data: existing } = await sb
    .from("exercise_library")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return existing as LibraryExercise;

  const isSkill = !!input.isSkill;
  const { data, error } = await sb
    .from("exercise_library")
    .insert({
      slug,
      name,
      category: input.category ?? (isSkill ? "skill" : "forca"),
      is_skill: isSkill,
      default_unit: isSkill ? "seconds" : "reps",
      owner_user_id: user.id,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as LibraryExercise;
}

// ── Skills + escadas ─────────────────────────────────────────────────
export async function listSkills(): Promise<SkillWithLadder[]> {
  const sb = await db();
  const { data: skills, error } = await sb
    .from("skills")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  const list = (skills ?? []) as Skill[];
  if (!list.length) return [];

  const ids = list.map((s) => s.id);
  const { data: levels, error: e2 } = await sb
    .from("skill_levels")
    .select("*")
    .in("skill_id", ids)
    .order("position", { ascending: true });
  if (e2) throw e2;

  const bySkill = new Map<string, SkillLevel[]>();
  for (const lv of (levels ?? []) as SkillLevel[]) {
    const arr = bySkill.get(lv.skill_id) ?? [];
    arr.push(lv);
    bySkill.set(lv.skill_id, arr);
  }
  return list.map((s) => ({ ...s, levels: bySkill.get(s.id) ?? [] }));
}

// ── Programa: leitura ────────────────────────────────────────────────
export async function listPrograms(): Promise<Program[]> {
  const sb = await db();
  const { data, error } = await sb
    .from("programs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Program[];
}

export async function getActiveProgram(): Promise<Program | null> {
  const sb = await db();
  const { data, error } = await sb
    .from("programs")
    .select("*")
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Program | null;
}

async function daysWithExercises(programId: string): Promise<ProgramDayWithExercises[]> {
  const sb = await db();
  const { data: days, error } = await sb
    .from("program_days")
    .select("*")
    .eq("program_id", programId)
    .order("position", { ascending: true });
  if (error) throw error;
  const list = (days ?? []) as ProgramDay[];
  if (!list.length) return [];

  const dayIds = list.map((d) => d.id);
  const { data: exs, error: e2 } = await sb
    .from("day_exercises")
    .select("*")
    .in("program_day_id", dayIds)
    .order("position", { ascending: true });
  if (e2) throw e2;

  const byDay = new Map<string, DayExercise[]>();
  for (const ex of (exs ?? []) as DayExercise[]) {
    const arr = byDay.get(ex.program_day_id) ?? [];
    arr.push(ex);
    byDay.set(ex.program_day_id, arr);
  }
  return list.map((d) => ({ ...d, exercises: byDay.get(d.id) ?? [] }));
}

/** Programa ativo do usuário, com dias e exercícios aninhados. */
export async function getActiveProgramView(): Promise<ProgramView | null> {
  const program = await getActiveProgram();
  if (!program) return null;
  const days = await daysWithExercises(program.id);
  return { ...program, days };
}

/** Um dia do programa (por code), com seus exercícios. */
export async function getProgramDay(
  programId: string,
  code: string
): Promise<ProgramDayWithExercises | null> {
  const days = await daysWithExercises(programId);
  return days.find((d) => d.code === code) ?? null;
}

// ── Programa: escrita ────────────────────────────────────────────────
export async function createProgram(p: ProgramInsert): Promise<Program> {
  const sb = await db();
  const row: Record<string, unknown> = {
    name: p.name,
    archetype: p.archetype ?? null,
    source: p.source ?? "manual",
    cycle_weeks: p.cycle_weeks ?? null,
    active: p.active ?? false,
  };
  // meta só vai no insert quando presente (coluna 008; tolera ausência — R8/R9).
  if (p.meta !== undefined && p.meta !== null) row.meta = p.meta;
  const { data, error } = await sb
    .from("programs")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    // Migração 008 ainda não aplicada (coluna `meta` inexistente) → reenvia sem
    // meta para não travar a geração. Auditoria volta quando a coluna existir.
    if ("meta" in row && /meta/i.test(error.message ?? "")) {
      delete row.meta;
      const retry = await sb.from("programs").insert(row).select("*").single();
      if (retry.error) throw retry.error;
      return retry.data as Program;
    }
    throw error;
  }
  return data as Program;
}

export async function createProgramDay(
  programId: string,
  d: ProgramDayInsert
): Promise<ProgramDay> {
  const sb = await db();
  const { data, error } = await sb
    .from("program_days")
    .insert({
      program_id: programId,
      code: d.code,
      weekday: d.weekday ?? null,
      title: d.title,
      focus: d.focus ?? null,
      character: d.character ?? null,
      position: d.position ?? 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProgramDay;
}

/** Cria (sem id) ou atualiza (com id) um exercício de um dia. */
export async function upsertDayExercise(
  programDayId: string,
  e: DayExerciseInsert & { id?: string }
): Promise<DayExercise> {
  const sb = await db();
  const row = {
    program_day_id: programDayId,
    exercise_id: e.exercise_id ?? null,
    exercise_name: e.exercise_name ?? null,
    is_skill: e.is_skill ?? false,
    prescription: e.prescription ?? null,
    target_unit: e.target_unit ?? "reps",
    target_min: e.target_min ?? null,
    target_max: e.target_max ?? null,
    rest_seconds: e.rest_seconds ?? null,
    position: e.position ?? 0,
    note: e.note ?? null,
  };
  if (e.id) {
    const { data, error } = await sb
      .from("day_exercises")
      .update(row)
      .eq("id", e.id)
      .select("*")
      .single();
    if (error) throw error;
    return data as DayExercise;
  }
  const { data, error } = await sb
    .from("day_exercises")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data as DayExercise;
}

/** Marca um programa como ativo (e desativa os demais do usuário). */
export async function setActiveProgram(programId: string): Promise<void> {
  const sb = await db();
  // Desativa todos os ativos antes (o índice parcial uq_programs_one_active
  // não deixaria dois ativos coexistirem).
  const { error: e1 } = await sb
    .from("programs")
    .update({ active: false })
    .eq("active", true)
    .neq("id", programId);
  if (e1) throw e1;
  const { error: e2 } = await sb
    .from("programs")
    .update({ active: true })
    .eq("id", programId);
  if (e2) throw e2;
}

/** Insere um ProgramDraft completo (programa → dias → exercícios). Se um dia
 *  ou exercício falhar, remove o programa criado (cascata limpa o resto). */
export async function insertProgramDraft(draft: ProgramDraft): Promise<Program> {
  const program = await createProgram({
    name: draft.name,
    archetype: draft.archetype,
    source: draft.source,
    cycle_weeks: draft.cycle_weeks,
    meta: draft.meta ?? null,
    active: false, // ativa no fim, via setActiveProgram, p/ não brigar com o índice
  });
  try {
    for (const d of draft.days) {
      const day = await createProgramDay(program.id, d);
      for (const ex of d.exercises) {
        await upsertDayExercise(day.id, ex);
      }
    }
    if (draft.active) await setActiveProgram(program.id);
    return program;
  } catch (err) {
    const sb = await db();
    await sb.from("programs").delete().eq("id", program.id);
    throw err;
  }
}

// ── Runtime: visão do programa ativo pronta para as telas (004) ──────────
// Entrega os dias no shape `PlanDay` (via adaptador), as escadas de skill, a
// periodização e um mapa de FK p/ salvar a sessão vinculada ao programa.
//
// Fallback (R1/R9): enquanto a migração 003 não estiver aplicada/semeada, não
// há programa ativo (ou a consulta falha). Nesse caso o runtime cai na semente
// PLAN — telas e player seguem funcionando, e a UI mostra um CTA de onboarding.

export interface SkillLadderView {
  slug: string;
  name: string;
  levels: string[];
}

export interface ActiveProgramRuntime {
  /** true => não há programa ativo no banco; estamos usando a semente PLAN. */
  fromSeed: boolean;
  programId: string | null;
  name: string;
  archetype: string | null;
  cycleWeeks: number;
  days: PlanDay[];
  periodization: CycleWeek[];
  ladders: SkillLadderView[];
  /** dayCode → (exerciseName → { programDayId, dayExerciseId }). */
  refMap: Map<string, Map<string, DayExerciseRef>>;
}

const SEED_LADDERS: SkillLadderView[] = [
  { slug: "front-lever", name: "Front Lever", levels: FL_PROGRESSION },
  { slug: "planche", name: "Planche", levels: PLANCHE_PROGRESSION },
];

function seedRuntime(): ActiveProgramRuntime {
  return {
    fromSeed: true,
    programId: null,
    name: "Retorno FL + Planche",
    archetype: "fl-planche",
    cycleWeeks: 12,
    days: PLAN,
    periodization: PERIODIZATION,
    ladders: SEED_LADDERS,
    refMap: new Map(),
  };
}

/** Escadas de skill do usuário (skill_levels), com fallback p/ a semente. */
async function ladderViews(): Promise<SkillLadderView[]> {
  try {
    const skills = await listSkills();
    const withLevels = skills.filter((s) => s.levels.length > 0);
    if (!withLevels.length) return SEED_LADDERS;
    return withLevels.map((s) => ({
      slug: s.slug,
      name: s.name,
      levels: adaptLadder(s),
    }));
  } catch {
    return SEED_LADDERS;
  }
}

/** Visão completa do programa ativo (ou semente) para o runtime. */
export async function getActiveProgramRuntime(): Promise<ActiveProgramRuntime> {
  let view: ProgramView | null = null;
  try {
    view = await getActiveProgramView();
  } catch {
    // Migração não aplicada / tabelas inexistentes → semente.
    return seedRuntime();
  }
  if (!view || !view.days.length) return seedRuntime();

  const ladders = await ladderViews();
  return {
    fromSeed: false,
    programId: view.id,
    name: view.name,
    archetype: view.archetype,
    cycleWeeks: view.cycle_weeks ?? 12,
    days: adaptProgram(view),
    periodization: PERIODIZATION, // periodização-como-dado: futura (ver adapter)
    ladders,
    refMap: buildExerciseRefMap(view),
  };
}

/** Ladder de um skill por slug (com fallback). Útil p/ progressão/início. */
export function ladderBySlug(
  ladders: SkillLadderView[],
  slug: string
): string[] {
  return ladders.find((l) => l.slug === slug)?.levels ?? [];
}

// ── Perfil / Anamnese (007) ──────────────────────────────────────────
// Persiste o AnamneseProfile na tabela `profiles` (PK = user_id, RLS por
// auth.uid()). Tudo via `await db()` (anon key + sessão); user_id é preenchido
// pelo default auth.uid() no banco. A lógica pura (validação/PAR-Q) fica em
// src/lib/anamnese.ts; aqui só fazemos o IO + (de)serialização do row.

/** Linha crua da tabela `profiles`. */
interface ProfileRow {
  user_id: string;
  archetype: string | null;
  goal_skill: string | null;
  age: number | null;
  sex: string | null;
  bodyweight: number | null;
  height: number | null;
  training_age: string | null;
  benchmarks: Record<string, number | string | null> | null;
  health_flags: HealthFlags | null;
  days_per_week: number | null;
  session_minutes: number | null;
  equipment: string[] | null;
  preferences: Record<string, unknown> | null;
  onboarding_path: string | null;
  completed_at: string | null;
  updated_at: string;
}

function rowToProfile(r: ProfileRow): AnamneseProfile {
  return {
    archetype: (r.archetype as AnamneseProfile["archetype"]) ?? null,
    goalSkill: r.goal_skill ?? null,
    age: r.age ?? null,
    sex: r.sex ?? null,
    bodyweight: r.bodyweight ?? null,
    height: r.height ?? null,
    trainingAge: r.training_age ?? null,
    benchmarks: r.benchmarks ?? {},
    healthFlags: r.health_flags ?? { level: "ok", flags: [], answers: {} },
    daysPerWeek: r.days_per_week ?? null,
    sessionMinutes: r.session_minutes ?? null,
    equipment: r.equipment ?? [],
    preferences: r.preferences ?? {},
    onboardingPath: (r.onboarding_path as AnamneseProfile["onboardingPath"]) ?? null,
  };
}

/** Lê o perfil do usuário logado, ou null se ainda não existe. */
export async function getProfile(): Promise<AnamneseProfile | null> {
  const sb = await db();
  const { data, error } = await sb.from("profiles").select("*").maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data as ProfileRow) : null;
}

/** Cria/atualiza o perfil do usuário (upsert por user_id default auth.uid()).
 *  `completed` marca o término da anamnese guiada (completed_at). */
export async function upsertProfile(
  profile: AnamneseProfile,
  opts: { completed?: boolean } = {}
): Promise<void> {
  const sb = await db();
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    archetype: profile.archetype,
    goal_skill: profile.goalSkill,
    age: profile.age,
    sex: profile.sex,
    bodyweight: profile.bodyweight,
    height: profile.height,
    training_age: profile.trainingAge,
    benchmarks: profile.benchmarks,
    health_flags: profile.healthFlags,
    days_per_week: profile.daysPerWeek,
    session_minutes: profile.sessionMinutes,
    equipment: profile.equipment,
    preferences: profile.preferences,
    onboarding_path: profile.onboardingPath,
    updated_at: now,
  };
  if (opts.completed) row.completed_at = now;
  const { error } = await sb.from("profiles").upsert(row, { onConflict: "user_id" });
  if (error) throw error;
}

// ── Geração de plano por IA / template (008) ─────────────────────────
// Constrói o SlugCatalog (slug → id/name/equipment) da biblioteca real (005) e
// orquestra a geração (plan-generator) com a IA injetada (ai.ts). Sempre produz
// um programa válido (fallback determinístico) e o persiste como ativo, com a
// trilha de auditoria (meta). Fallback de catálogo p/ os seeds quando a
// biblioteca ainda não está aplicada (R1/R9).

/** Catálogo de slugs da biblioteca real (005). Vazio/erro => usa seeds offline. */
export async function getSlugCatalog(): Promise<SlugCatalog> {
  try {
    const lib = await listLibrary();
    if (!lib.length) return buildSeedCatalog();
    const map: SlugCatalog = new Map();
    for (const e of lib) {
      map.set(e.slug, {
        id: e.id,
        name: e.name,
        equipment: (e.equipment ?? []).filter((eq) =>
          ["bar", "rings", "parallettes", "dip-bar", "band"].includes(eq)
        ),
      });
    }
    return map;
  } catch {
    return buildSeedCatalog();
  }
}

/** Gera o plano a partir do perfil (007), valida, persiste como programa ativo
 *  (source=ai) com auditoria, e retorna o programa + metadados da geração.
 *  A chamada de IA é resolvida aqui (ai.ts) mas só roda se OPENAI_API_KEY existir;
 *  sem ela, cai no fallback determinístico — tudo via uma única função. */
export async function generateProgramFromProfile(
  profile: AnamneseProfile,
  opts: { activate?: boolean } = {}
): Promise<{ program: Program; origin: "ai" | "fallback"; issues: string[] }> {
  const catalog = await getSlugCatalog();

  // IA injetada só quando habilitada (evita import de server-only desnecessário).
  let callAi: GenerateOptions["callAi"];
  let aiToDraft: GenerateOptions["aiToDraft"];
  const { getAiConfig } = await import("./ai");
  if (getAiConfig().enabled) {
    const { generatePlanWithAI } = await import("./ai");
    const { aiPlanToDraft } = await import("./plan-schema");
    callAi = (a) => generatePlanWithAI(a);
    aiToDraft = (raw) =>
      aiPlanToDraft(raw, (slug) => {
        const info = catalog.get(slug);
        return info ? { id: info.id, name: info.name } : null;
      });
  }

  const result = await generatePlan({ profile, catalog, callAi, aiToDraft });

  const draft: ProgramDraft = {
    ...result.plan,
    source: "ai",
    meta: {
      templateId: result.templateId,
      model: getAiConfig().enabled ? getAiConfig().model : undefined,
      inputProfileHash: profileHash(profile),
      origin: result.origin,
      attempts: result.attempts,
      issues: result.validation.issues.map((i) => `[${i.code}] ${i.where}: ${i.message}`),
    },
  };

  const program = await insertProgramDraft({ ...draft, active: !!opts.activate });
  return {
    program,
    origin: result.origin,
    issues: result.validation.issues.map((i) => i.message),
  };
}

/** Registra apenas a via escolhida no fork (guided | freestyle), sem exigir a
 *  anamnese completa. Reversível: chamar de novo troca a via. */
export async function setOnboardingPath(path: OnboardingPath): Promise<void> {
  const sb = await db();
  const { error } = await sb
    .from("profiles")
    .upsert(
      { onboarding_path: path, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (error) throw error;
}
