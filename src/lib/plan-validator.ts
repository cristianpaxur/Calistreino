// Camada de sanidade do plano (008 / T-003). PURA (sem IO) → testável offline.
//
// Esta é a REDE DE SEGURANÇA que torna a IA confiável o suficiente para um
// produto público: a IA (ou o fallback) propõe um ProgramDraft; o validador
// CHECA contra tetos clínicos e, quando possível, AJUSTA (clamp) em vez de só
// rejeitar. O que ele garante (CA-002/CA-003):
//   • volume por dia/semana dentro do teto (evita prescrição perigosa);
//   • descanso mínimo respeitado (skills isométricos pedem mais);
//   • frequência (nº de dias) coerente com a disponibilidade;
//   • exercícios SÓ da biblioteca (exercise_id presente OU slug conhecido) — sem invenção;
//   • coerência com equipamento (não prescreve barra sem barra) e lesão (poda holds pesados).
//
// O gerador chama `validatePlan`; se `ok=false` e a IA reentrega, regenera com o
// feedback de `issues`; após N falhas, usa o fallback determinístico (já válido).

import type { ProgramDraft, ProgramDraftDay, DayExerciseInsert } from "./program-types.ts";

// ── Limites clínicos (conservadores; reusam a filosofia de coach.ts) ──
export const LIMITS = {
  /** Máx. de séries de trabalho somadas num único dia. */
  maxSetsPerDay: 28,
  /** Máx. de exercícios distintos num dia. */
  maxExercisesPerDay: 8,
  /** Mín. de exercícios por dia para um treino fazer sentido. */
  minExercisesPerDay: 2,
  /** Máx. de dias de treino por semana. */
  maxDaysPerWeek: 6,
  /** Descanso mínimo (s) entre séries de força. */
  minRestStrength: 45,
  /** Descanso mínimo (s) entre holds de skill isométrico (alta demanda articular). */
  minRestSkill: 90,
  /** Teto de segundos por hold de skill (acima disso vira treino, não hold limpo). */
  maxSkillHoldSeconds: 30,
  /** Teto de reps numa única série (acima é fadiga/forma comprometida). */
  maxReps: 30,
} as const;

export interface PlanIssue {
  /** Caminho legível: "D1 / Pull-ups". */
  where: string;
  /** Código curto p/ feedback à IA. */
  code:
    | "no_exercise_ref"
    | "volume_day"
    | "too_many_exercises"
    | "too_few_exercises"
    | "rest_too_low"
    | "hold_too_long"
    | "reps_too_high"
    | "equipment_mismatch"
    | "injury_unsafe"
    | "frequency"
    | "empty_plan";
  message: string;
  /** true => o validador conseguiu ajustar (clamp); false => bloqueante. */
  fixed: boolean;
}

export interface ValidationContext {
  /** Equipamento disponível do perfil (007). Vazio => só peso do corpo. */
  equipment: string[];
  /** Dias/semana desejados (limita a frequência). */
  daysPerWeek: number | null;
  /** Nível PAR-Q: "block" poda holds pesados e exige modo conservador. */
  parqLevel: "ok" | "warn" | "block";
  /** Slugs conhecidos da biblioteca (005). Quando vazio, a checagem de
   *  "só biblioteca" é relaxada (migração/seed não aplicados — R1/R9). */
  knownSlugs?: Set<string>;
  /** Slugs que exigem equipamento: slug → equipamento necessário. */
  slugEquipment?: Map<string, string[]>;
  /** Slugs proibidos por lesão (ex.: holds de skill no PAR-Q block). */
  bannedSlugs?: Set<string>;
}

export interface PlanValidationResult {
  ok: boolean;
  /** Draft possivelmente AJUSTADO (clamp de rest/holds/reps/volume). */
  plan: ProgramDraft;
  issues: PlanIssue[];
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Indica se um exercício referencia a biblioteca de forma válida. */
function hasValidRef(ex: DayExerciseInsert & { slug?: string }, ctx: ValidationContext): boolean {
  // Tem id da biblioteca explícito → ok.
  if (ex.exercise_id) return true;
  // Sem knownSlugs (seed não aplicado) → aceitamos nome livre (fallback).
  if (!ctx.knownSlugs || ctx.knownSlugs.size === 0) return true;
  // Caso contrário exigimos um slug conhecido.
  const slug = (ex as { slug?: string }).slug;
  return !!slug && ctx.knownSlugs.has(slug);
}

function validateDay(
  day: ProgramDraftDay,
  ctx: ValidationContext,
  issues: PlanIssue[]
): ProgramDraftDay {
  const code = day.code ?? "D?";
  const kept: DayExerciseInsert[] = [];
  let totalSets = 0;

  for (const ex0 of day.exercises) {
    const ex = { ...ex0 } as DayExerciseInsert & { slug?: string };
    const label = `${code} / ${ex.exercise_name ?? (ex as { slug?: string }).slug ?? "?"}`;

    // Lesão: poda slugs banidos (PAR-Q block → sem holds de skill pesados).
    if (ctx.bannedSlugs && (ex as { slug?: string }).slug && ctx.bannedSlugs.has((ex as { slug?: string }).slug!)) {
      issues.push({ where: label, code: "injury_unsafe", message: "Exercício removido por triagem de saúde (PAR-Q).", fixed: true });
      continue;
    }

    // Só biblioteca (RNF-001).
    if (!hasValidRef(ex, ctx)) {
      issues.push({ where: label, code: "no_exercise_ref", message: "Exercício fora da biblioteca curada — removido.", fixed: true });
      continue;
    }

    // Coerência de equipamento: se o slug exige equipamento que falta, e há
    // alternativa, o gerador já trocou; aqui rejeitamos o que sobrou inviável.
    const need = (ex as { slug?: string }).slug && ctx.slugEquipment?.get((ex as { slug?: string }).slug!);
    if (need && need.length > 0) {
      const haveAll = need.some((e) => ctx.equipment.includes(e));
      if (!haveAll) {
        issues.push({ where: label, code: "equipment_mismatch", message: `Requer ${need.join("/")} indisponível — removido.`, fixed: true });
        continue;
      }
    }

    // Clamp de descanso mínimo conforme o tipo.
    const minRest = ex.is_skill ? LIMITS.minRestSkill : LIMITS.minRestStrength;
    if (ex.rest_seconds != null && ex.rest_seconds < minRest) {
      issues.push({ where: label, code: "rest_too_low", message: `Descanso ${ex.rest_seconds}s < mínimo ${minRest}s — ajustado.`, fixed: true });
      ex.rest_seconds = minRest;
    }
    if (ex.rest_seconds == null) ex.rest_seconds = minRest;

    // Clamp de holds de skill (segundos).
    if (ex.is_skill && ex.target_unit === "seconds") {
      if (ex.target_max != null && ex.target_max > LIMITS.maxSkillHoldSeconds) {
        issues.push({ where: label, code: "hold_too_long", message: `Hold ${ex.target_max}s > teto ${LIMITS.maxSkillHoldSeconds}s — ajustado.`, fixed: true });
        ex.target_max = LIMITS.maxSkillHoldSeconds;
      }
      if (ex.target_min != null && ex.target_max != null && ex.target_min > ex.target_max) {
        ex.target_min = ex.target_max;
      }
    }

    // Clamp de reps (não-skill).
    if (!ex.is_skill && ex.target_unit === "reps" && ex.target_max != null && ex.target_max > LIMITS.maxReps) {
      issues.push({ where: label, code: "reps_too_high", message: `${ex.target_max} reps > teto ${LIMITS.maxReps} — ajustado.`, fixed: true });
      ex.target_max = LIMITS.maxReps;
      if (ex.target_min != null && ex.target_min > ex.target_max) ex.target_min = ex.target_max;
    }

    // Acumula volume (séries). Sem séries declaradas conta como 3 (padrão).
    const setsMatch = ex.prescription?.match(/(\d+)\s*[×x]/);
    const sets = setsMatch ? Number(setsMatch[1]) : 3;
    totalSets += Number.isFinite(sets) ? sets : 3;

    kept.push(ex);
  }

  // Teto de exercícios por dia: poda os opcionais/extras do fim.
  if (kept.length > LIMITS.maxExercisesPerDay) {
    issues.push({ where: code, code: "too_many_exercises", message: `${kept.length} exercícios > ${LIMITS.maxExercisesPerDay} — cortado.`, fixed: true });
    kept.length = LIMITS.maxExercisesPerDay;
  }

  // Teto de volume por dia: poda do fim até caber.
  while (totalSets > LIMITS.maxSetsPerDay && kept.length > LIMITS.minExercisesPerDay) {
    const removed = kept.pop();
    const m = removed?.prescription?.match(/(\d+)\s*[×x]/);
    totalSets -= m ? Number(m[1]) : 3;
    issues.push({ where: code, code: "volume_day", message: "Volume diário acima do teto — exercício extra removido.", fixed: true });
  }

  // Mínimo de exercícios: dia muito magro (ex.: tudo podado por falta de
  // equipamento) é DESCARTADO no nível do plano, não bloqueia. Sinalizamos como
  // ajustado (fixed=true); validatePlan remove o dia abaixo do mínimo.
  if (kept.length < LIMITS.minExercisesPerDay) {
    issues.push({ where: code, code: "too_few_exercises", message: `Dia com menos de ${LIMITS.minExercisesPerDay} exercícios — removido.`, fixed: true });
  }

  return { ...day, exercises: kept };
}

/** Valida (e ajusta) um ProgramDraft. Retorna o plano possivelmente clampado +
 *  a lista de issues. `ok=false` só quando há issue bloqueante (fixed=false) ou
 *  o plano fica vazio/incoerente. */
export function validatePlan(
  draft: ProgramDraft,
  ctx: ValidationContext
): PlanValidationResult {
  const issues: PlanIssue[] = [];

  let days = (draft.days ?? []).map((d) => validateDay(d, ctx, issues));
  // Remove dias abaixo do mínimo de exercícios (vazios ou magros demais — ex.:
  // tudo podado por falta de equipamento).
  days = days.filter((d) => d.exercises.length >= LIMITS.minExercisesPerDay);

  // Frequência: corta dias além da disponibilidade (mantém os primeiros).
  const cap = Math.min(ctx.daysPerWeek ?? LIMITS.maxDaysPerWeek, LIMITS.maxDaysPerWeek);
  if (cap > 0 && days.length > cap) {
    issues.push({ where: "plano", code: "frequency", message: `Reduzido para ${cap} dias/semana conforme disponibilidade.`, fixed: true });
    days = days.slice(0, cap);
  }

  if (days.length === 0) {
    issues.push({ where: "plano", code: "empty_plan", message: "Plano sem dias válidos.", fixed: false });
    return { ok: false, plan: { ...draft, days }, issues };
  }

  const plan: ProgramDraft = { ...draft, days };
  const blocking = issues.some((i) => !i.fixed);
  return { ok: !blocking, plan, issues };
}

/** Resumo textual das issues para realimentar a IA (T-006). */
export function issuesFeedback(issues: PlanIssue[]): string {
  if (!issues.length) return "Nenhum problema.";
  return issues
    .map((i) => `- [${i.code}] ${i.where}: ${i.message}`)
    .join("\n");
}
