// Teste OFFLINE (sem rede) — 009: milestones + avaliação semanal + ajustes.
// Roda com type-stripping nativo do Node (v23+): node scripts/verify-progression.ts
//
// Cobre:
//   • T-002: deriveMilestones gera metas coerentes por skill/objetivo + semana-alvo.
//   • T-003: buildAdjustments traduz o report em ajustes (advance/hold/deload).
//   • T-004: computeMilestoneStatus reflete o histórico (achieved/in_progress).
//   • T-007/T-008: avanço, regressão, dor → ajuste correto; conclusão dispara loop.

import {
  deriveMilestones,
  computeMilestoneStatus,
  updateMilestoneStatuses,
  isGoalComplete,
  type Milestone,
} from "../src/lib/milestones.ts";
import { buildReport, buildAdjustments } from "../src/lib/coach.ts";
import { evaluateWeek } from "../src/lib/progression.ts";
import { emptyProfile, type AnamneseProfile } from "../src/lib/anamnese.ts";
import type { SkillPoint } from "../src/lib/queries.ts";
import type { SessionRow } from "../src/lib/db.ts";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    console.error("  ✗ " + msg);
    failures++;
  } else {
    console.log("  ✓ " + msg);
  }
}

const FL_LEVELS = ["Tuck", "Advanced tuck", "Straddle / One-leg", "Full Front Lever"];
const PL_LEVELS = ["Planche lean", "Tuck", "Advanced tuck", "Straddle", "Full Planche"];

const program = {
  archetype: "skill",
  cycleWeeks: 12,
  ladders: [
    { slug: "front-lever", name: "Front Lever", levels: FL_LEVELS },
    { slug: "planche", name: "Planche", levels: PL_LEVELS },
  ],
};

function flProfile(over: Partial<AnamneseProfile> = {}): AnamneseProfile {
  return { ...emptyProfile(), archetype: "skill", goalSkill: "front-lever", ...over };
}

function pt(date: string, hold: number, lever: string): SkillPoint {
  return { date, max_hold_s: hold, lever, exercise: "Front Lever", session_id: 1 };
}

function session(over: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 1,
    date: "2026-06-01",
    day_code: "D1",
    week: 1,
    block: "Acumulação",
    elbow_pain: 0,
    lower_back: 0,
    notes: null,
    created_at: "2026-06-01T00:00:00Z",
    ...over,
  };
}

// ── T-002: deriveMilestones ──────────────────────────────────────────
console.log("deriveMilestones — metas por objetivo");
{
  const ms = deriveMilestones(program, flProfile());
  check(ms.length >= 2, `gera milestones (${ms.length})`);
  const goalMs = ms.filter((m) => m.skillSlug === "front-lever");
  check(goalMs.length === 2, "skill-alvo recebe 2 marcos (hold + alavanca-alvo)");
  check(
    goalMs.some((m) => m.targetUnit === "lever" && m.targetLever === "Full Front Lever"),
    "marco de alavanca-alvo = alavanca final da escada"
  );
  check(
    goalMs.some((m) => m.targetUnit === "seconds" && (m.targetValue ?? 0) >= 12),
    "marco de hold-alvo ≥ 12s"
  );
  check(
    ms.filter((m) => m.skillSlug === "planche").length === 1,
    "skill não-alvo recebe só o checkpoint de hold"
  );
  check(ms.every((m) => m.dueWeek != null && m.dueWeek <= 12), "todo marco tem semana-alvo ≤ ciclo");
  // determinismo
  const ms2 = deriveMilestones(program, flProfile());
  check(JSON.stringify(ms) === JSON.stringify(ms2), "derivação é determinística");
}

// objetivo não-skill (health) → milestone livre de consistência
{
  const ms = deriveMilestones(
    { archetype: "health", cycleWeeks: 8, ladders: [] },
    { ...emptyProfile(), archetype: "health" }
  );
  check(
    ms.some((m) => m.skillSlug === null && (m.targetValue ?? 0) === 8),
    "health sem escadas → milestone livre de consistência (8 semanas)"
  );
}

// ── T-004: computeMilestoneStatus ────────────────────────────────────
console.log("\ncomputeMilestoneStatus — status pelos dados");
{
  const holdMs: Milestone = {
    skillSlug: "front-lever",
    description: "hold 12s",
    targetUnit: "seconds",
    targetValue: 12,
    targetLever: null,
    dueWeek: 6,
    status: "pending",
    position: 0,
  };
  check(
    computeMilestoneStatus(holdMs, {
      points: [pt("2026-06-01", 5, "Tuck")],
      currentLever: "Tuck",
      ladderLevels: FL_LEVELS,
      sessionsDone: 1,
    }) === "in_progress",
    "hold 5s (<12) → in_progress"
  );
  check(
    computeMilestoneStatus(holdMs, {
      points: [pt("2026-06-01", 13, "Tuck")],
      currentLever: "Tuck",
      ladderLevels: FL_LEVELS,
      sessionsDone: 1,
    }) === "achieved",
    "hold 13s (≥12) → achieved"
  );

  const leverMs: Milestone = {
    skillSlug: "front-lever",
    description: "alcançar Full Front Lever",
    targetUnit: "lever",
    targetValue: null,
    targetLever: "Full Front Lever",
    dueWeek: 12,
    status: "pending",
    position: 1,
  };
  check(
    computeMilestoneStatus(leverMs, {
      points: [],
      currentLever: "Advanced tuck",
      ladderLevels: FL_LEVELS,
      sessionsDone: 5,
    }) === "in_progress",
    "alavanca atual abaixo da alvo → in_progress"
  );
  check(
    computeMilestoneStatus(leverMs, {
      points: [],
      currentLever: "Full Front Lever",
      ladderLevels: FL_LEVELS,
      sessionsDone: 5,
    }) === "achieved",
    "alavanca atual = alvo → achieved"
  );

  const freeMs: Milestone = {
    skillSlug: null,
    description: "12 semanas",
    targetUnit: "reps",
    targetValue: 12,
    targetLever: null,
    dueWeek: 12,
    status: "pending",
    position: 0,
  };
  check(
    computeMilestoneStatus(freeMs, { points: [], currentLever: null, ladderLevels: [], sessionsDone: 12 }) ===
      "achieved",
    "milestone livre: 12 sessões → achieved"
  );
}

// ── T-003 + T-007: buildAdjustments (avanço / dor / deload) ──────────
console.log("\nbuildAdjustments — ajustes pelas regras");
const ladders = program.ladders.map((l) => ({ slug: l.slug, levels: l.levels }));
{
  // Avanço: max-hold ≥ 12 na alavanca atual → advance p/ próxima alavanca.
  const report = buildReport({
    front: [pt("2026-06-01", 13, "Tuck"), pt("2026-06-05", 14, "Tuck")],
    planche: [],
    pain: [],
    recentSessions: [session()],
    block: "Acumulação",
  });
  const adj = buildAdjustments(report, ladders);
  const advance = adj.find((a) => a.kind === "advance" && a.skillSlug === "front-lever");
  check(!!advance, "max-hold ≥12 → ajuste advance no FL");
  check(advance?.toLever === "Advanced tuck", "advance aponta a próxima alavanca da escada");
}
{
  // Dor: cotovelo ≥3 em 2 sessões → deload global (precede skills).
  const report = buildReport({
    front: [pt("2026-06-01", 6, "Tuck")],
    planche: [],
    pain: [],
    recentSessions: [session({ elbow_pain: 4 }), session({ id: 2, elbow_pain: 3 })],
    block: "Acumulação",
  });
  const adj = buildAdjustments(report, ladders);
  check(adj.length === 1 && adj[0].kind === "deload", "cotovelo ≥3 ×2 → único ajuste deload global");
}
{
  // Regressão: tempo caiu vs. sessão anterior → hold (segurar).
  const report = buildReport({
    front: [pt("2026-06-01", 9, "Tuck"), pt("2026-06-05", 6, "Tuck")],
    planche: [],
    pain: [],
    recentSessions: [session()],
    block: "Acumulação",
  });
  const adj = buildAdjustments(report, ladders);
  check(
    adj.some((a) => a.kind === "hold" && a.skillSlug === "front-lever"),
    "queda de tempo → ajuste hold no FL"
  );
}

// ── T-007/T-008: evaluateWeek + isGoalComplete (loop de objetivo) ────
console.log("\nevaluateWeek + isGoalComplete — loop de objetivo");
{
  const milestones = deriveMilestones(program, flProfile());
  const evalRes = evaluateWeek({
    week: 12,
    block: "Pico / Teste",
    pain: [],
    recentSessions: [session()],
    skills: [
      {
        slug: "front-lever",
        name: "Front Lever",
        points: [pt("2026-06-01", 15, "Full Front Lever")],
        currentLever: "Full Front Lever",
        levels: FL_LEVELS,
      },
      { slug: "planche", name: "Planche", points: [], currentLever: null, levels: PL_LEVELS },
    ],
    milestones,
    goalSkill: "front-lever",
    sessionsDone: 20,
  });
  const flDone = evalRes.milestones.filter((m) => m.skillSlug === "front-lever");
  check(flDone.every((m) => m.status === "achieved"), "FL com hold 15s + alavanca final → marcos atingidos");
  check(evalRes.goalComplete, "todos os marcos da skill-alvo atingidos → goalComplete=true");
}
{
  // ainda incompleto
  const milestones = deriveMilestones(program, flProfile());
  const updated = updateMilestoneStatuses(
    milestones,
    new Map([
      [
        "front-lever",
        { points: [pt("2026-06-01", 5, "Tuck")], currentLever: "Tuck", ladderLevels: FL_LEVELS },
      ],
    ]),
    3
  );
  check(!isGoalComplete(updated, "front-lever"), "marcos pendentes → goalComplete=false");
}

if (failures) {
  console.error(`\n${failures} verificação(ões) falharam.`);
  process.exit(1);
}
console.log("\nTudo verde (009 offline).");
