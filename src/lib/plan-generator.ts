// Orquestração da geração de plano (008 / T-004,T-005,T-006). PURO no núcleo:
// a chamada de IA é INJETADA (callAi) → testável offline sem rede.
//
// Fluxo (RF-001..RF-005 / §3.5):
//   1. selectTemplate(perfil) → template do arquétipo/skill.
//   2. buildFromTemplate(perfil, template) → ProgramDraft determinístico (fallback).
//   3. Se há IA (callAi): pede o plano estruturado; valida; em falha regenera com
//      feedback (até maxRetries); se nunca passar, cai no fallback do passo 2.
//   4. validatePlan ajusta/clampa o resultado final (rede de segurança).
//
// `buildFromTemplate` e `generatePlan` não tocam o banco. A persistência fica em
// programs.ts::insertProgramDraft (chamado pela action). O catálogo de slugs
// (knownSlugs/slugEquipment) é passado de fora (resolvido do banco OU dos seeds).

import type { ProgramDraft, ProgramDraftDay, DayExerciseInsert } from "./program-types.ts";
import type { AnamneseProfile } from "./anamnese.ts";
import {
  selectTemplate,
  type ProgramTemplate,
  type TemplateDay,
  type TemplateSlot,
} from "../../supabase/seeds/templates.ts";
import {
  validatePlan,
  issuesFeedback,
  type ValidationContext,
  type PlanValidationResult,
} from "./plan-validator.ts";
import type { AiPlan } from "./plan-schema.ts";

// ── Catálogo (slug → metadados) injetado de fora ─────────────────────
export interface SlugInfo {
  id: string | null; // id da biblioteca (null = só seed)
  name: string;
  equipment: string[]; // equipamento necessário
}
export type SlugCatalog = Map<string, SlugInfo>;

// ── Parametrização determinística ────────────────────────────────────

/** Escolhe a alavanca certa de uma escada de skill pelo benchmark do exame
 *  físico (007). `regressions` vem do mais fácil ao mais difícil; o último é a
 *  meta. Heurística conservadora: holds < 8s → começa na 1ª regressão; 8–12s →
 *  meio; ≥12s → topo. Sem benchmark → 1ª regressão (mais segura). */
export function pickLeverSlug(
  slot: TemplateSlot,
  skillHoldSeconds: number | null,
  parqBlock: boolean
): string {
  const ladder = [...(slot.regressions ?? []), slot.slug];
  if (ladder.length === 1) return slot.slug;
  // PAR-Q block → sempre a regressão mais fácil.
  if (parqBlock) return ladder[0];
  const h = skillHoldSeconds ?? 0;
  let idx: number;
  if (h <= 0) idx = 0;
  else if (h < 8) idx = Math.min(1, ladder.length - 1);
  else if (h < 12) idx = Math.floor((ladder.length - 1) / 2);
  else idx = ladder.length - 1;
  return ladder[Math.max(0, Math.min(idx, ladder.length - 1))];
}

/** Resolve o slug efetivo de um slot conforme equipamento disponível: usa o
 *  primário se o equipamento bate; senão a 1ª alternativa viável; senão a 1ª
 *  regressão viável; senão null (slot inviável → será podado). */
export function resolveSlot(
  slot: TemplateSlot,
  ctx: { equipment: string[]; catalog: SlugCatalog }
): string | null {
  const needs = (slug: string): string[] => {
    const fromCatalog = ctx.catalog.get(slug)?.equipment;
    if (fromCatalog) return fromCatalog;
    // fallback: o próprio slot declara needsEquipment p/ o primário.
    return slug === slot.slug ? slot.needsEquipment ?? [] : [];
  };
  const viable = (slug: string): boolean => {
    const need = needs(slug);
    if (!need.length) return true; // só peso do corpo / chão
    return need.some((e) => ctx.equipment.includes(e));
  };
  const candidates = [slot.slug, ...(slot.alts ?? []), ...(slot.regressions ?? [])];
  for (const c of candidates) {
    if (viable(c)) return c;
  }
  // nenhum viável → o mais fácil (regressão) como último recurso (chão).
  return slot.regressions?.[0] ?? null;
}

/** Nº de séries dentro da faixa do slot conforme intensidade preferida. */
function setsFor(slot: TemplateSlot, intensity: string | undefined): number {
  const [lo, hi] = slot.sets ?? [3, 3];
  if (intensity === "easy") return lo;
  if (intensity === "hard") return hi;
  return Math.round((lo + hi) / 2);
}

function slotToExercise(
  slot: TemplateSlot,
  slug: string,
  profile: AnamneseProfile,
  catalog: SlugCatalog,
  position: number
): DayExerciseInsert & { slug: string } {
  const unit = slot.unit ?? (slot.isSkill ? "seconds" : "reps");
  const [tmin, tmax] = slot.target ?? (unit === "seconds" ? [5, 10] : [8, 12]);
  const intensity = profile.preferences.intensity as string | undefined;
  const sets = setsFor(slot, intensity);
  const rest = slot.restSeconds ?? (slot.isSkill ? 150 : 90);
  const lib = catalog.get(slug);
  const unitTxt = unit === "seconds" ? "s" : "";
  const range = tmin === tmax ? `${tmax}${unitTxt}` : `${tmin}-${tmax}${unitTxt}`;
  return {
    exercise_id: lib?.id ?? null,
    exercise_name: lib?.name ?? slug,
    is_skill: !!slot.isSkill,
    prescription: `${sets} × ${range}`,
    target_unit: unit,
    target_min: tmin,
    target_max: tmax,
    rest_seconds: rest,
    position,
    note: null,
    slug,
  };
}

/** Quantos slots manter por dia conforme tempo de sessão (poda opcionais). */
function slotBudget(sessionMinutes: number | null): number {
  if (!sessionMinutes) return 8;
  if (sessionMinutes <= 30) return 3;
  if (sessionMinutes <= 45) return 4;
  if (sessionMinutes <= 60) return 5;
  return 8;
}

function buildDay(
  tday: TemplateDay,
  profile: AnamneseProfile,
  catalog: SlugCatalog,
  budget: number
): ProgramDraftDay {
  const parqBlock = profile.healthFlags.level === "block";
  const skillHold =
    typeof profile.benchmarks.bm_skill_hold_s === "number"
      ? (profile.benchmarks.bm_skill_hold_s as number)
      : null;

  // Ordena: foco e obrigatórios primeiro; opcionais por último (poda os finais).
  const ordered = [...tday.slots].sort((a, b) => {
    const oa = a.isFocus ? 0 : a.optional ? 2 : 1;
    const ob = b.isFocus ? 0 : b.optional ? 2 : 1;
    return oa - ob;
  });

  const exercises: (DayExerciseInsert & { slug: string })[] = [];
  for (const slot of ordered) {
    if (exercises.length >= budget) break;
    // Skill de foco → escolhe a alavanca pela escada/benchmark.
    const slug = slot.isFocus
      ? pickLeverSlug(slot, skillHold, parqBlock)
      : resolveSlot(slot, { equipment: profile.equipment, catalog });
    if (!slug) continue; // slot inviável → poda
    // PAR-Q block: pula holds de skill não-foco (conservador).
    if (parqBlock && slot.isSkill && !slot.isFocus) continue;
    exercises.push(slotToExercise(slot, slug, profile, catalog, exercises.length));
  }

  return {
    code: tday.code,
    title: tday.title,
    focus: tday.focus,
    character: tday.character,
    position: 0,
    exercises,
  };
}

/** Fallback determinístico (RF-005): plano só a partir do template parametrizado
 *  pelo perfil — SEM IA. Sempre coerente. */
export function buildFromTemplate(
  profile: AnamneseProfile,
  template: ProgramTemplate,
  catalog: SlugCatalog
): ProgramDraft {
  const budget = slotBudget(profile.sessionMinutes);
  const cap = Math.min(profile.daysPerWeek ?? template.days.length, template.days.length);
  const days = template.days
    .slice(0, Math.max(2, cap))
    .map((d, i) => ({ ...buildDay(d, profile, catalog, budget), position: i }))
    .filter((d) => d.exercises.length > 0);

  return {
    name: template.name,
    archetype: template.archetype === "skill" ? template.goalSkill ?? "skill" : template.archetype,
    source: "ai", // origem do PLANO gerado (IA configura o template); fallback marca ai também
    cycle_weeks: template.cycleWeeks,
    days,
  };
}

// ── Contexto de validação derivado do perfil + catálogo ──────────────
export function validationContextFor(
  profile: AnamneseProfile,
  catalog: SlugCatalog
): ValidationContext {
  const knownSlugs = new Set(catalog.keys());
  const slugEquipment = new Map<string, string[]>();
  for (const [slug, info] of catalog) {
    if (info.equipment?.length) slugEquipment.set(slug, info.equipment);
  }
  // PAR-Q block → bane holds de skill pesados (full/straddle) por segurança.
  const banned = new Set<string>();
  if (profile.healthFlags.level === "block") {
    for (const slug of knownSlugs) {
      if (/^(full|straddle|advanced-tuck)-(front-lever|planche)$/.test(slug) || slug === "muscle-up") {
        banned.add(slug);
      }
    }
  }
  return {
    equipment: profile.equipment,
    daysPerWeek: profile.daysPerWeek,
    parqLevel: profile.healthFlags.level,
    knownSlugs: knownSlugs.size ? knownSlugs : undefined,
    slugEquipment,
    bannedSlugs: banned.size ? banned : undefined,
  };
}

// ── Geração orquestrada (IA + validação + fallback) ──────────────────
export interface GenerateOptions {
  profile: AnamneseProfile;
  catalog: SlugCatalog;
  /** Caller de IA INJETADO. Recebe o template + feedback; devolve o AiPlan
   *  bruto ou lança. Ausente => só fallback determinístico (sem rede). */
  callAi?: (args: {
    template: ProgramTemplate;
    profile: AnamneseProfile;
    allowedSlugs: string[];
    feedback?: string;
  }) => Promise<AiPlan>;
  /** Quantas regenerações tentar antes do fallback. Default 2. */
  maxRetries?: number;
  /** Converte o AiPlan bruto em ProgramDraft (resolve slug→id). Necessário
   *  quando callAi está presente. */
  aiToDraft?: (plan: AiPlan) => ProgramDraft;
}

export interface GenerateResult {
  plan: ProgramDraft;
  validation: PlanValidationResult;
  /** "ai" => veio da IA e passou; "fallback" => template determinístico. */
  origin: "ai" | "fallback";
  /** Trilha de auditoria. */
  templateId: string;
  attempts: number;
}

/** Gera o plano final válido (sempre retorna algo executável). */
export async function generatePlan(opts: GenerateOptions): Promise<GenerateResult> {
  const { profile, catalog } = opts;
  const template = selectTemplate(profile.archetype, profile.goalSkill);
  const ctx = validationContextFor(profile, catalog);
  const allowedSlugs = [...catalog.keys()];
  const maxRetries = opts.maxRetries ?? 2;

  let attempts = 0;

  // Tentativas de IA (se injetada).
  if (opts.callAi && opts.aiToDraft) {
    let feedback: string | undefined;
    for (let i = 0; i < maxRetries; i++) {
      attempts++;
      try {
        const raw = await opts.callAi({ template, profile, allowedSlugs, feedback });
        const draft = opts.aiToDraft(raw);
        const result = validatePlan(draft, ctx);
        if (result.ok) {
          return { plan: result.plan, validation: result, origin: "ai", templateId: template.id, attempts };
        }
        feedback = issuesFeedback(result.issues);
      } catch {
        // erro de rede/parse → próxima tentativa ou fallback.
        feedback = "A resposta anterior falhou ou era inválida. Siga o schema estritamente.";
      }
    }
  }

  // Fallback determinístico (sempre válido).
  const fallback = buildFromTemplate(profile, template, catalog);
  const result = validatePlan(fallback, ctx);
  return { plan: result.plan, validation: result, origin: "fallback", templateId: template.id, attempts };
}

/** Hash estável e curto do perfil (auditoria / cache por hash — RNF-002). Puro,
 *  determinístico, sem dependência de crypto (roda no edge/offline). */
export function profileHash(profile: AnamneseProfile): string {
  const key = JSON.stringify({
    a: profile.archetype,
    g: profile.goalSkill,
    b: profile.benchmarks,
    h: profile.healthFlags.level,
    d: profile.daysPerWeek,
    m: profile.sessionMinutes,
    e: [...profile.equipment].sort(),
    p: profile.preferences,
  });
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}
