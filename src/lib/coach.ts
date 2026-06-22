// Motor de recomendação determinístico — decide subir/manter/reduzir intensidade
// com base nas regras do PDF (avanço de alavanca, deload por cotovelo, lombar).
// Funciona sempre, offline. A camada de IA (lib/ai.ts) é opcional e complementar.

import type { SkillPoint, PainPoint } from "./queries";
import type { SessionRow } from "./db";

export type Verdict = "subir" | "manter" | "reduzir" | "sem-dados";

export interface SkillRecommendation {
  skill: "Front Lever" | "Planche";
  currentLever: string | null;
  verdict: Verdict;
  reasons: string[];
  bestHold: number | null;
  lastHold: number | null;
  trend: "up" | "down" | "flat" | null;
}

export interface Flag {
  level: "danger" | "warn" | "ok";
  text: string;
}

export interface CoachReport {
  recommendations: SkillRecommendation[];
  flags: Flag[];
  overall: string;
  deload: boolean;
}

// Limiares (do PDF): avançar com 3 holds limpos de 8-10s OU max-hold ≥ 12-15s.
const ADVANCE_MAX_HOLD = 12;
const CLEAN_HOLD = 8;
const CLEAN_SESSIONS_NEEDED = 2;

function analyzeSkill(
  skill: "Front Lever" | "Planche",
  points: SkillPoint[],
  deload: boolean
): SkillRecommendation {
  if (points.length === 0) {
    return {
      skill,
      currentLever: null,
      verdict: "sem-dados",
      reasons: ["Sem registros de max-hold ainda. Registre algumas sessões."],
      bestHold: null,
      lastHold: null,
      trend: null,
    };
  }

  const last = points[points.length - 1];
  const currentLever = last.lever;
  const lastHold = last.max_hold_s;

  // Pontos na alavanca atual
  const onCurrent = currentLever
    ? points.filter((p) => p.lever === currentLever)
    : points;
  const bestHold = Math.max(...onCurrent.map((p) => p.max_hold_s));
  const cleanSessions = onCurrent.filter((p) => p.max_hold_s >= CLEAN_HOLD).length;

  // Tendência: compara as duas últimas sessões na alavanca atual
  let trend: "up" | "down" | "flat" | null = null;
  if (onCurrent.length >= 2) {
    const prev = onCurrent[onCurrent.length - 2].max_hold_s;
    if (lastHold > prev) trend = "up";
    else if (lastHold < prev) trend = "down";
    else trend = "flat";
  }

  const reasons: string[] = [];
  let verdict: Verdict = "manter";

  if (deload) {
    verdict = "reduzir";
    reasons.push("Semana/condição de deload: segure a intensidade.");
  } else if (bestHold >= ADVANCE_MAX_HOLD || cleanSessions >= CLEAN_SESSIONS_NEEDED) {
    verdict = "subir";
    if (bestHold >= ADVANCE_MAX_HOLD)
      reasons.push(`Max-hold de ${bestHold}s na alavanca atual (≥ ${ADVANCE_MAX_HOLD}s).`);
    if (cleanSessions >= CLEAN_SESSIONS_NEEDED)
      reasons.push(`${cleanSessions} sessões com holds limpos ≥ ${CLEAN_HOLD}s.`);
    reasons.push("Pronto para avançar a alavanca (ou aumentar a dificuldade).");
  } else if (trend === "down") {
    verdict = "reduzir";
    reasons.push("Max-hold caiu vs. a sessão anterior — recupere antes de progredir.");
  } else {
    verdict = "manter";
    if (trend === "up")
      reasons.push("Tempo subindo: adicione +1s ou +1 rep na próxima sessão.");
    else
      reasons.push(
        `Continue acumulando holds limpos (meta: ${CLEAN_HOLD}-10s) na alavanca atual.`
      );
  }

  return { skill, currentLever, verdict, reasons, bestHold, lastHold, trend };
}

export function buildReport(input: {
  front: SkillPoint[];
  planche: SkillPoint[];
  pain: PainPoint[];
  recentSessions: SessionRow[];
  block: string;
}): CoachReport {
  const { front, planche, pain, recentSessions, block } = input;
  const flags: Flag[] = [];

  // Deload por bloco de periodização
  const blockDeload = /deload/i.test(block);
  if (blockDeload)
    flags.push({ level: "warn", text: "Semana de deload: reduza ~50% do volume." });

  // Cotovelo ≥ 3 em 2 sessões consecutivas → deload
  const lastTwo = recentSessions.slice(0, 2);
  const elbowDeload =
    lastTwo.length === 2 &&
    lastTwo.every((s) => (s.elbow_pain ?? 0) >= 3);
  if (elbowDeload)
    flags.push({
      level: "danger",
      text: "Cotovelo ≥ 3 em 2 sessões seguidas → faça deload (regra do plano).",
    });

  // Lombar > 0 em dias estáticos (D1, D2, D4, D5)
  const staticDays = new Set(["D1", "D2", "D4", "D5"]);
  const lowerBackFlag = recentSessions
    .slice(0, 5)
    .some((s) => staticDays.has(s.day_code) && (s.lower_back ?? 0) > 0);
  if (lowerBackFlag)
    flags.push({
      level: "warn",
      text: "Lombar > 0 em estáticos: revise a técnica e priorize coluna neutra.",
    });

  if (flags.length === 0)
    flags.push({ level: "ok", text: "Sem sinais de alerta. Bom para progredir." });

  const deload = blockDeload || elbowDeload;

  const recommendations = [
    analyzeSkill("Front Lever", front, deload),
    analyzeSkill("Planche", planche, deload),
  ];

  let overall: string;
  if (deload) {
    overall = "Reduza a intensidade nesta fase (deload) e foque em recuperação e técnica.";
  } else if (recommendations.some((r) => r.verdict === "reduzir")) {
    overall = "Atenção: segure a intensidade em pelo menos um skill antes de avançar.";
  } else if (recommendations.some((r) => r.verdict === "subir")) {
    overall = "Você está pronto para aumentar a intensidade — avance a alavanca onde indicado.";
  } else {
    overall = "Mantenha e progrida em pequenos incrementos (+1s ou +1 rep por sessão).";
  }

  return { recommendations, flags, overall, deload };
}
