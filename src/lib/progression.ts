// 009 — Avaliação semanal / de ciclo (PURO, sem IO).
//
// Compõe as peças puras já existentes (coach.buildReport + buildAdjustments,
// milestones.updateMilestoneStatuses + isGoalComplete) numa única avaliação que o
// runtime consome. NÃO faz IO: recebe os dados já lidos e devolve o veredito,
// ajustes propostos, milestones atualizados e o sinal de objetivo concluído.
//
// O IO (ler entries, persistir milestones/ajustes, aplicar ao programa) fica em
// src/lib/progression-io.ts. Testável offline em scripts/verify-progression.ts.

import type { SkillPoint, PainPoint } from "./queries.ts";
import type { SessionRow } from "./db.ts";
import {
  buildReport,
  buildAdjustments,
  type CoachReport,
  type PlanAdjustment,
} from "./coach.ts";
import {
  updateMilestoneStatuses,
  isGoalComplete,
  type Milestone,
} from "./milestones.ts";

export interface WeekEvaluation {
  week: number;
  block: string;
  report: CoachReport;
  adjustments: PlanAdjustment[];
  milestones: Milestone[];
  goalComplete: boolean;
}

export interface SkillSeries {
  slug: string;
  name: string;
  points: SkillPoint[];
  currentLever: string | null;
  levels: string[];
}

export interface EvaluateWeekInput {
  week: number;
  block: string;
  pain: PainPoint[];
  recentSessions: SessionRow[];
  /** séries por skill (front/planche/…); cada uma com pontos + escada. */
  skills: SkillSeries[];
  milestones: Milestone[];
  goalSkill: string | null;
  /** total de sessões realizadas (alimenta milestones livres de consistência). */
  sessionsDone: number;
}

/** Casa o slug da skill às séries `front`/`planche` que o coach.buildReport espera. */
function seriesBySlug(skills: SkillSeries[], slug: string): SkillPoint[] {
  return skills.find((s) => s.slug === slug)?.points ?? [];
}

/** Avaliação semanal completa (RF-002/RF-003 base). Pura: o mesmo input → mesmo output. */
export function evaluateWeek(input: EvaluateWeekInput): WeekEvaluation {
  const front = seriesBySlug(input.skills, "front-lever");
  const planche = seriesBySlug(input.skills, "planche");

  const report = buildReport({
    front,
    planche,
    pain: input.pain,
    recentSessions: input.recentSessions,
    block: input.block,
  });

  const ladders = input.skills.map((s) => ({ slug: s.slug, levels: s.levels }));
  const adjustments = buildAdjustments(report, ladders);

  const bySkill = new Map<
    string | null,
    { points: SkillPoint[]; currentLever: string | null; ladderLevels: string[] }
  >();
  for (const s of input.skills) {
    bySkill.set(s.slug, {
      points: s.points,
      currentLever: s.currentLever,
      ladderLevels: s.levels,
    });
  }

  const milestones = updateMilestoneStatuses(
    input.milestones,
    bySkill,
    input.sessionsDone
  );
  const goalComplete = isGoalComplete(milestones, input.goalSkill);

  return {
    week: input.week,
    block: input.block,
    report,
    adjustments,
    milestones,
    goalComplete,
  };
}
