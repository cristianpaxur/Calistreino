// Anamnese estruturada (007) — schema do perfil + banco de perguntas + lógica
// de ramificação, validação e triagem PAR-Q.
//
// TUDO neste arquivo é PURO (sem IO): testável offline. A persistência fica em
// src/lib/programs.ts (upsertProfile/getProfile) e as actions chamam essas
// funções. O `AnamneseProfile` é o CONTRATO que a geração de plano (008) consome.

// ── Domínio ──────────────────────────────────────────────────────────
export type Archetype = "skill" | "strength" | "health";
export type OnboardingPath = "guided" | "freestyle";
export type ParqLevel = "ok" | "warn" | "block";

export const ARCHETYPES: { value: Archetype; label: string; blurb: string }[] = [
  { value: "skill", label: "Caçar uma skill", blurb: "Front lever, planche, muscle-up…" },
  { value: "strength", label: "Ficar mais forte", blurb: "Força e volume gerais em calistenia" },
  { value: "health", label: "Saúde & movimento", blurb: "Condicionamento, mobilidade, consistência" },
];

// Skills-alvo oferecidas quando o arquétipo é "skill". slug = chave estável (008).
export const GOAL_SKILLS: { slug: string; label: string }[] = [
  { slug: "front-lever", label: "Front Lever" },
  { slug: "planche", label: "Planche" },
  { slug: "muscle-up", label: "Muscle-up" },
  { slug: "handstand", label: "Handstand / Apoio" },
  { slug: "pull-up", label: "Barra / Pull-up" },
];

export const EQUIPMENT: { value: string; label: string }[] = [
  { value: "bar", label: "Barra fixa" },
  { value: "parallettes", label: "Paralelas / paralettes" },
  { value: "rings", label: "Argolas" },
  { value: "bands", label: "Elásticos" },
  { value: "dip-station", label: "Estação de dips" },
  { value: "none", label: "Só peso do corpo / chão" },
];

// ── Perfil estruturado (o que vai para a tabela `profiles`) ──────────
export interface AnamneseProfile {
  archetype: Archetype | null;
  goalSkill: string | null;
  age: number | null;
  sex: string | null;
  bodyweight: number | null; // kg
  height: number | null; // cm
  trainingAge: string | null; // none | lt1y | 1to3y | gt3y
  /** benchmarks auto-reportados por padrão de movimento. */
  benchmarks: Record<string, number | string | null>;
  /** resultado da triagem de saúde (PAR-Q). */
  healthFlags: HealthFlags;
  daysPerWeek: number | null;
  sessionMinutes: number | null;
  equipment: string[];
  preferences: Record<string, unknown>;
  onboardingPath: OnboardingPath | null;
}

export interface HealthFlags {
  level: ParqLevel;
  flags: string[];
  answers: Record<string, boolean>;
}

export function emptyProfile(): AnamneseProfile {
  return {
    archetype: null,
    goalSkill: null,
    age: null,
    sex: null,
    bodyweight: null,
    height: null,
    trainingAge: null,
    benchmarks: {},
    healthFlags: { level: "ok", flags: [], answers: {} },
    daysPerWeek: null,
    sessionMinutes: null,
    equipment: [],
    preferences: {},
    onboardingPath: null,
  };
}

// ── Banco de perguntas ───────────────────────────────────────────────
export type QuestionKind =
  | "single" // uma opção
  | "multi" // várias opções
  | "number"
  | "text"
  | "parq"; // booleana de triagem (sim/não)

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

export interface Question {
  id: string;
  kind: QuestionKind;
  label: string;
  help?: string;
  options?: Option[];
  optional?: boolean;
  min?: number;
  max?: number;
  unit?: string;
  placeholder?: string;
}

export type SectionId =
  | "goal"
  | "skill"
  | "profile"
  | "benchmarks"
  | "parq"
  | "logistics"
  | "preferences";

export interface Section {
  id: SectionId;
  title: string;
  subtitle?: string;
  questions: Question[];
}

// Perguntas de benchmark comuns (auto-reportadas). Mantidas conservadoras:
// a calibração da Semana 1 (009) corrige superestimativas.
const BENCHMARK_QUESTIONS: Question[] = [
  {
    id: "bm_pushups",
    kind: "number",
    label: "Flexões seguidas (boa forma)",
    help: "Quantas você faz sem parar, peito até o chão.",
    min: 0,
    max: 200,
    unit: "reps",
    optional: true,
  },
  {
    id: "bm_pullups",
    kind: "number",
    label: "Barras seguidas (queixo acima)",
    min: 0,
    max: 100,
    unit: "reps",
    optional: true,
  },
  {
    id: "bm_dips",
    kind: "number",
    label: "Paralelas / dips seguidas",
    min: 0,
    max: 100,
    unit: "reps",
    optional: true,
  },
  {
    id: "bm_hollow_s",
    kind: "number",
    label: "Hollow hold (segundos)",
    help: "Lombar colada no chão.",
    min: 0,
    max: 300,
    unit: "s",
    optional: true,
  },
];

// Benchmark extra específico de skill (só aparece no caminho "skill").
const SKILL_BENCHMARK: Question = {
  id: "bm_skill_hold_s",
  kind: "number",
  label: "Melhor hold na skill alvo (segundos)",
  help: "Na alavanca mais difícil que você segura limpa. 0 se ainda não consegue.",
  min: 0,
  max: 120,
  unit: "s",
  optional: true,
};

// PAR-Q condensado (triagem de prontidão). Cada resposta "sim" levanta uma flag.
export const PARQ_QUESTIONS: Question[] = [
  { id: "parq_heart", kind: "parq", label: "Algum problema cardíaco ou pressão diagnosticados?" },
  { id: "parq_chest_pain", kind: "parq", label: "Dor no peito ao se esforçar ou em repouso?" },
  { id: "parq_dizzy", kind: "parq", label: "Tonturas, desmaios ou perda de equilíbrio recentes?" },
  { id: "parq_joint", kind: "parq", label: "Lesão articular/óssea que piora com exercício?" },
  { id: "parq_lower_back", kind: "parq", label: "Dor lombar irradiando, formigamento ou fraqueza na perna?" },
  { id: "parq_meds", kind: "parq", label: "Uso de medicação para coração/pressão?" },
  { id: "parq_other", kind: "parq", label: "Algum outro motivo para não fazer atividade física?" },
];

// Respostas de PAR-Q que, sozinhas, BLOQUEIAM o caminho automático e exigem
// liberação profissional antes de gerar/iniciar plano.
const PARQ_BLOCKING = new Set([
  "parq_heart",
  "parq_chest_pain",
  "parq_dizzy",
  "parq_lower_back",
]);

const SHARED_PROFILE: Question[] = [
  { id: "age", kind: "number", label: "Idade", min: 12, max: 100, unit: "anos" },
  {
    id: "sex",
    kind: "single",
    label: "Sexo",
    optional: true,
    options: [
      { value: "male", label: "Masculino" },
      { value: "female", label: "Feminino" },
      { value: "other", label: "Outro" },
      { value: "undisclosed", label: "Prefiro não dizer" },
    ],
  },
  { id: "bodyweight", kind: "number", label: "Peso", min: 30, max: 250, unit: "kg" },
  { id: "height", kind: "number", label: "Altura", min: 120, max: 230, unit: "cm", optional: true },
  {
    id: "trainingAge",
    kind: "single",
    label: "Há quanto tempo treina?",
    options: [
      { value: "none", label: "Estou começando" },
      { value: "lt1y", label: "Menos de 1 ano" },
      { value: "1to3y", label: "1 a 3 anos" },
      { value: "gt3y", label: "Mais de 3 anos" },
    ],
  },
];

const LOGISTICS: Question[] = [
  {
    id: "daysPerWeek",
    kind: "single",
    label: "Quantos dias por semana?",
    options: [
      { value: "2", label: "2 dias" },
      { value: "3", label: "3 dias" },
      { value: "4", label: "4 dias" },
      { value: "5", label: "5+ dias" },
    ],
  },
  {
    id: "sessionMinutes",
    kind: "single",
    label: "Tempo por sessão?",
    options: [
      { value: "30", label: "~30 min" },
      { value: "45", label: "~45 min" },
      { value: "60", label: "~60 min" },
      { value: "90", label: "90+ min" },
    ],
  },
  {
    id: "equipment",
    kind: "multi",
    label: "Equipamento disponível",
    help: "Marque tudo que você tem acesso.",
    options: EQUIPMENT,
  },
];

const PREFERENCES: Question[] = [
  {
    id: "pref_intensity",
    kind: "single",
    label: "Como prefere a intensidade?",
    optional: true,
    options: [
      { value: "easy", label: "Progredir devagar e seguro" },
      { value: "balanced", label: "Equilíbrio" },
      { value: "hard", label: "Puxar forte" },
    ],
  },
  {
    id: "pref_notes",
    kind: "text",
    label: "Algo a evitar ou enfatizar? (opcional)",
    placeholder: "ex: ombro sensível, foco em core…",
    optional: true,
  },
];

/** Banco completo de seções na ordem do wizard. A ramificação por arquétipo é
 *  aplicada por `sectionsFor()`, não aqui. */
export const SECTIONS: Section[] = [
  {
    id: "goal",
    title: "Seu objetivo",
    subtitle: "Por onde a gente começa?",
    questions: [
      {
        id: "archetype",
        kind: "single",
        label: "O que você quer da calistenia agora?",
        options: ARCHETYPES.map((a) => ({ value: a.value, label: a.label, hint: a.blurb })),
      },
    ],
  },
  {
    id: "skill",
    title: "Qual skill",
    subtitle: "O alvo que vai guiar a progressão.",
    questions: [
      {
        id: "goalSkill",
        kind: "single",
        label: "Qual skill você quer conquistar?",
        options: GOAL_SKILLS.map((s) => ({ value: s.slug, label: s.label })),
      },
    ],
  },
  { id: "profile", title: "Seu perfil", questions: SHARED_PROFILE },
  {
    id: "benchmarks",
    title: "Exame físico",
    subtitle: "Auto-reportado — começa conservador e auto-calibra.",
    questions: BENCHMARK_QUESTIONS, // SKILL_BENCHMARK é injetado em sectionsFor()
  },
  {
    id: "parq",
    title: "Triagem de saúde",
    subtitle: "PAR-Q — responda com sinceridade. Sem julgamento.",
    questions: PARQ_QUESTIONS,
  },
  { id: "logistics", title: "Logística", questions: LOGISTICS },
  { id: "preferences", title: "Preferências", questions: PREFERENCES },
];

// ── Ramificação por arquétipo ────────────────────────────────────────
/** Retorna as seções aplicáveis ao arquétipo escolhido, na ordem do wizard.
 *  - skill:    inclui "skill" + benchmark de skill.
 *  - strength/health: pula a seção "skill" e o benchmark de skill. */
export function sectionsFor(archetype: Archetype | null): Section[] {
  return SECTIONS.flatMap((sec) => {
    if (sec.id === "skill" && archetype !== "skill") return [];
    if (sec.id === "benchmarks") {
      const questions =
        archetype === "skill" ? [SKILL_BENCHMARK, ...sec.questions] : sec.questions;
      return [{ ...sec, questions }];
    }
    return [sec];
  });
}

/** Conta de perguntas no caminho típico (para a barra de progresso / RNF-001). */
export function questionCount(archetype: Archetype | null): number {
  return sectionsFor(archetype).reduce((n, s) => n + s.questions.length, 0);
}

// ── Triagem PAR-Q ────────────────────────────────────────────────────
/** Avalia as respostas booleanas do PAR-Q e devolve nível + flags.
 *  - block: qualquer resposta crítica (coração, dor no peito, tontura, lombar irradiando).
 *  - warn:  qualquer outro "sim" (lesão articular, medicação, outro motivo).
 *  - ok:    nenhum "sim". */
export function evaluateParq(answers: Record<string, boolean>): HealthFlags {
  const flags: string[] = [];
  let level: ParqLevel = "ok";
  for (const q of PARQ_QUESTIONS) {
    if (answers[q.id]) {
      flags.push(q.id);
      if (PARQ_BLOCKING.has(q.id)) level = "block";
      else if (level !== "block") level = "warn";
    }
  }
  return { level, flags, answers };
}

/** Mensagem de disclaimer conforme o nível PAR-Q. Texto provisório — a redação
 *  final é portão humano (revisão jurídica, §3-E item 23 do roadmap). */
export function parqDisclaimer(level: ParqLevel): string | null {
  if (level === "block")
    return (
      "Suas respostas indicam sinais que pedem liberação de um profissional de saúde " +
      "ANTES de iniciar. Procure um médico/educador físico. Você pode salvar o perfil, " +
      "mas o plano sairá em modo conservador até a liberação."
    );
  if (level === "warn")
    return (
      "Atenção: respeite limites e progrida com cautela. Em caso de dor persistente, " +
      "procure um profissional. O plano será ajustado de forma conservadora."
    );
  return null;
}

// ── Validação (pura) ─────────────────────────────────────────────────
export interface ValidationResult {
  ok: boolean;
  errors: Record<string, string>; // por questionId
}

/** Valida as respostas de UMA seção (obrigatórias preenchidas, números no range).
 *  `values` é o mapa questionId → valor cru (string/array). */
export function validateSection(
  section: Section,
  values: Record<string, unknown>
): ValidationResult {
  const errors: Record<string, string> = {};
  for (const q of section.questions) {
    const v = values[q.id];
    if (q.kind === "parq") continue; // PAR-Q: ausência = "não"
    const empty =
      v === undefined ||
      v === null ||
      v === "" ||
      (Array.isArray(v) && v.length === 0);
    if (empty) {
      if (!q.optional) errors[q.id] = "Obrigatório.";
      continue;
    }
    if (q.kind === "number") {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) errors[q.id] = "Número inválido.";
      else if (q.min !== undefined && n < q.min) errors[q.id] = `Mínimo ${q.min}.`;
      else if (q.max !== undefined && n > q.max) errors[q.id] = `Máximo ${q.max}.`;
    }
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Valida o perfil completo (todas as seções do arquétipo). Usado na ação de
 *  salvar como rede de segurança server-side. */
export function validateProfile(profile: AnamneseProfile): ValidationResult {
  const sections = sectionsFor(profile.archetype);
  const values = profileToValues(profile);
  const errors: Record<string, string> = {};
  for (const sec of sections) {
    const r = validateSection(sec, values);
    Object.assign(errors, r.errors);
  }
  if (!profile.archetype) errors.archetype = "Escolha um objetivo.";
  return { ok: Object.keys(errors).length === 0, errors };
}

// ── Conversões valores ⇆ perfil (puras) ─────────────────────────────
/** Achata o perfil em um mapa questionId → valor (para revalidar / pré-preencher). */
export function profileToValues(p: AnamneseProfile): Record<string, unknown> {
  return {
    archetype: p.archetype ?? "",
    goalSkill: p.goalSkill ?? "",
    age: p.age,
    sex: p.sex ?? "",
    bodyweight: p.bodyweight,
    height: p.height,
    trainingAge: p.trainingAge ?? "",
    daysPerWeek: p.daysPerWeek != null ? String(p.daysPerWeek) : "",
    sessionMinutes: p.sessionMinutes != null ? String(p.sessionMinutes) : "",
    equipment: p.equipment,
    ...p.benchmarks,
    ...Object.fromEntries(PARQ_QUESTIONS.map((q) => [q.id, !!p.healthFlags.answers[q.id]])),
    pref_intensity: (p.preferences.intensity as string) ?? "",
    pref_notes: (p.preferences.notes as string) ?? "",
  };
}

/** Monta um `AnamneseProfile` a partir do mapa cru de respostas do wizard.
 *  Centraliza a normalização (números, equipamento, benchmarks, PAR-Q, prefs). */
export function buildProfile(
  values: Record<string, unknown>,
  onboardingPath: OnboardingPath = "guided"
): AnamneseProfile {
  const archetype = (values.archetype as Archetype) || null;
  const numOrNull = (v: unknown): number | null => {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // benchmarks: todas as questões bm_* presentes.
  const benchmarks: Record<string, number | string | null> = {};
  for (const key of Object.keys(values)) {
    if (key.startsWith("bm_")) benchmarks[key] = numOrNull(values[key]);
  }

  // PAR-Q
  const answers: Record<string, boolean> = {};
  for (const q of PARQ_QUESTIONS) answers[q.id] = !!values[q.id];
  const healthFlags = evaluateParq(answers);

  const equipment = Array.isArray(values.equipment)
    ? (values.equipment as string[])
    : values.equipment
      ? [String(values.equipment)]
      : [];

  const preferences: Record<string, unknown> = {};
  if (values.pref_intensity) preferences.intensity = values.pref_intensity;
  if (values.pref_notes) preferences.notes = String(values.pref_notes).trim();

  return {
    archetype,
    goalSkill: archetype === "skill" ? ((values.goalSkill as string) || null) : null,
    age: numOrNull(values.age),
    sex: (values.sex as string) || null,
    bodyweight: numOrNull(values.bodyweight),
    height: numOrNull(values.height),
    trainingAge: (values.trainingAge as string) || null,
    benchmarks,
    healthFlags,
    daysPerWeek: numOrNull(values.daysPerWeek),
    sessionMinutes: numOrNull(values.sessionMinutes),
    equipment,
    preferences,
    onboardingPath,
  };
}
