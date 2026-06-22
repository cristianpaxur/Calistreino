// 009 — Milestones por objetivo (PURO, sem IO).
//
// Deriva metas/checkpoints a partir do programa ativo + perfil e calcula o status
// de cada milestone a partir do histórico (max-holds / alavanca atual). Toda a
// lógica aqui é determinística e testável offline (scripts/verify-progression.ts).
// A persistência fica em src/lib/progression-io.ts.

import type { AnamneseProfile } from "./anamnese.ts";
import type { SkillPoint } from "./queries.ts";
import { leverIndex } from "./plan.ts";

export type MilestoneUnit = "seconds" | "reps" | "lever";
export type MilestoneStatus = "pending" | "in_progress" | "achieved";

/** Meta derivada/persistível. `id` só existe quando vem do banco. */
export interface Milestone {
  id?: string;
  skillSlug: string | null;
  description: string;
  targetUnit: MilestoneUnit;
  /** alvo numérico (s/rep). null quando targetUnit = "lever". */
  targetValue: number | null;
  /** alavanca-alvo (quando targetUnit = "lever"). */
  targetLever: string | null;
  dueWeek: number | null;
  status: MilestoneStatus;
  position: number;
}

/** Programa mínimo necessário para derivar milestones (evita acoplar à view). */
export interface MilestoneProgramInput {
  archetype: string | null;
  cycleWeeks: number;
  /** escadas de skill do programa (slug → níveis ordenados do mais fácil ao mais difícil). */
  ladders: { slug: string; name: string; levels: string[] }[];
}

// Limiares de hold-alvo por etapa do ciclo (espelham os do coach.ts: ≥12s = avançar).
const HOLD_CHECKPOINT_S = 8; // hold limpo intermediário
const HOLD_TARGET_S = 12; // pronto para a próxima alavanca

/** Slug da skill-alvo do perfil mapeado para o slug da escada (quando casam). */
function goalLadder(
  program: MilestoneProgramInput,
  profile: AnamneseProfile | null
): { slug: string; name: string; levels: string[] } | null {
  const goal = profile?.goalSkill ?? null;
  if (goal) {
    const byGoal = program.ladders.find((l) => l.slug === goal);
    if (byGoal) return byGoal;
  }
  // sem objetivo explícito → primeira escada do programa (se houver).
  return program.ladders[0] ?? null;
}

/** Deriva os milestones de um programa/objetivo (RF-001). Determinístico: o mesmo
 *  programa+perfil sempre gera a mesma lista (idempotência na persistência). */
export function deriveMilestones(
  program: MilestoneProgramInput,
  profile: AnamneseProfile | null
): Milestone[] {
  const out: Milestone[] = [];
  const cycle = program.cycleWeeks > 0 ? program.cycleWeeks : 12;
  let pos = 0;

  // Para cada escada de skill do programa: checkpoint de hold no meio do ciclo e
  // meta de alavanca-alvo (próxima alavanca ou a final) no fim do ciclo.
  for (const ladder of program.ladders) {
    if (!ladder.levels.length) continue;
    const isGoal =
      profile?.goalSkill === ladder.slug ||
      (!profile?.goalSkill && out.length === 0);

    // Checkpoint de hold limpo (semana ~metade do ciclo).
    out.push({
      skillSlug: ladder.slug,
      description: `${ladder.name}: hold limpo de ${HOLD_TARGET_S}s na alavanca atual`,
      targetUnit: "seconds",
      targetValue: HOLD_TARGET_S,
      targetLever: null,
      dueWeek: Math.max(1, Math.round(cycle / 2)),
      status: "pending",
      position: pos++,
    });

    // Meta de alavanca-alvo no fim do ciclo: a alavanca final da escada.
    const finalLever = ladder.levels[ladder.levels.length - 1];
    out.push({
      skillSlug: ladder.slug,
      description: `${ladder.name}: alcançar ${finalLever}`,
      targetUnit: "lever",
      targetValue: null,
      targetLever: finalLever,
      dueWeek: cycle,
      status: "pending",
      position: pos++,
    });

    // Só a skill-alvo recebe os dois marcos; demais escadas, só o checkpoint de hold.
    if (!isGoal) out.pop();
  }

  // Objetivos não-skill (strength/health): consistência como milestone livre.
  if (!out.length || program.archetype === "strength" || program.archetype === "health") {
    out.push({
      skillSlug: null,
      description: `Completar ${cycle} semanas de treino consistente`,
      targetUnit: "reps",
      targetValue: cycle,
      targetLever: null,
      dueWeek: cycle,
      status: "pending",
      position: pos++,
    });
  }

  return out;
}

/** Maior hold registrado na escada (qualquer alavanca). */
function bestHold(points: SkillPoint[]): number {
  return points.reduce((m, p) => Math.max(m, p.max_hold_s), 0);
}

/** Calcula o status de UM milestone a partir do histórico da skill correspondente.
 *  - lever: atingido quando a alavanca atual ≥ alavanca-alvo na escada.
 *  - seconds/reps: atingido quando o melhor valor ≥ alvo; in_progress se ≥ checkpoint.
 *  `sessionsDone` alimenta os milestones livres de consistência (skillSlug null). */
export function computeMilestoneStatus(
  m: Milestone,
  ctx: {
    points: SkillPoint[];
    currentLever: string | null;
    ladderLevels: string[];
    sessionsDone: number;
  }
): MilestoneStatus {
  if (m.skillSlug === null) {
    // meta livre: consistência (sessões realizadas vs. alvo).
    const target = m.targetValue ?? 0;
    if (target > 0 && ctx.sessionsDone >= target) return "achieved";
    return ctx.sessionsDone > 0 ? "in_progress" : "pending";
  }

  if (m.targetUnit === "lever" && m.targetLever) {
    const targetIdx = leverIndex(ctx.ladderLevels, m.targetLever);
    const curIdx = leverIndex(ctx.ladderLevels, ctx.currentLever);
    if (targetIdx >= 0 && curIdx >= targetIdx) return "achieved";
    if (curIdx >= 0) return "in_progress";
    return "pending";
  }

  // seconds / reps
  const best = bestHold(ctx.points);
  const target = m.targetValue ?? HOLD_TARGET_S;
  if (best >= target) return "achieved";
  if (best >= HOLD_CHECKPOINT_S) return "in_progress";
  return ctx.points.length ? "in_progress" : "pending";
}

/** Aplica o status calculado a uma lista de milestones, dado o histórico por skill. */
export function updateMilestoneStatuses(
  milestones: Milestone[],
  bySkill: Map<string | null, { points: SkillPoint[]; currentLever: string | null; ladderLevels: string[] }>,
  sessionsDone: number
): Milestone[] {
  return milestones.map((m) => {
    const ctx = bySkill.get(m.skillSlug) ?? {
      points: [],
      currentLever: null,
      ladderLevels: [],
    };
    return { ...m, status: computeMilestoneStatus(m, { ...ctx, sessionsDone }) };
  });
}

/** O objetivo está completo quando todos os milestones da skill-alvo (ou todos, se
 *  não houver skill-alvo) estão `achieved`. Dispara o loop de novo objetivo (RF-004). */
export function isGoalComplete(
  milestones: Milestone[],
  goalSkill: string | null
): boolean {
  if (!milestones.length) return false;
  const relevant = goalSkill
    ? milestones.filter((m) => m.skillSlug === goalSkill)
    : milestones;
  const target = relevant.length ? relevant : milestones;
  return target.every((m) => m.status === "achieved");
}
