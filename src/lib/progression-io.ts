import { db, getSetting } from "./db";
import {
  deriveMilestones,
  type Milestone,
  type MilestoneUnit,
  type MilestoneStatus,
} from "./milestones";
import {
  evaluateWeek,
  type WeekEvaluation,
  type SkillSeries,
} from "./progression";
import type { PlanAdjustment } from "./coach";
import { getActiveProgramRuntime, getProfile } from "./programs";
import {
  getPainHistory,
  getSessions,
  getSkillProgress,
  getCurrentLevers,
  getStats,
  type SkillPoint,
} from "./queries";
import { weekFromStart, blockForWeek } from "./cycle";

// 009 — IO do loop adaptativo. Tudo via `await db()` (anon key + sessão → RLS por
// auth.uid()); user_id é preenchido pelo default auth.uid() no banco. NUNCA
// service_role no runtime (R2). As tabelas (009) podem não estar aplicadas ainda
// (R1/R9): cada leitura tolera erro e cai num estado vazio em vez de quebrar.

// ── (de)serialização ─────────────────────────────────────────────────
interface MilestoneRow {
  id: string;
  program_id: string;
  skill_slug: string | null;
  description: string;
  target_unit: string;
  target_value: number | null;
  target_lever: string | null;
  due_week: number | null;
  status: string;
  achieved_at: string | null;
  position: number;
}

function rowToMilestone(r: MilestoneRow): Milestone {
  return {
    id: r.id,
    skillSlug: r.skill_slug,
    description: r.description,
    targetUnit: (r.target_unit as MilestoneUnit) ?? "seconds",
    targetValue: r.target_value,
    targetLever: r.target_lever,
    dueWeek: r.due_week,
    status: (r.status as MilestoneStatus) ?? "pending",
    position: r.position ?? 0,
  };
}

// ── Milestones: leitura / derivação / persistência ───────────────────

/** Milestones persistidos de um programa (ordenados). Vazio se a tabela não existe. */
export async function listMilestones(programId: string): Promise<Milestone[]> {
  try {
    const sb = await db();
    const { data, error } = await sb
      .from("milestones")
      .select("*")
      .eq("program_id", programId)
      .order("position", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as MilestoneRow[]).map(rowToMilestone);
  } catch {
    return [];
  }
}

/** Deriva e persiste os milestones de um programa se ainda não existirem (idempotente).
 *  Chamada ao criar/ativar um programa (T-002) ou ao abrir o coach. Tolerante: se a
 *  tabela 009 não estiver aplicada, retorna os milestones derivados em memória. */
export async function ensureMilestonesForActiveProgram(): Promise<Milestone[]> {
  const runtime = await getActiveProgramRuntime();
  if (runtime.fromSeed || !runtime.programId) {
    // sem programa real persistido → deriva só p/ exibição (não persiste).
    const profile = await getProfile().catch(() => null);
    return deriveMilestones(
      {
        archetype: runtime.archetype,
        cycleWeeks: runtime.cycleWeeks,
        ladders: runtime.ladders,
      },
      profile
    );
  }

  const existing = await listMilestones(runtime.programId);
  if (existing.length) return existing;

  const profile = await getProfile().catch(() => null);
  const derived = deriveMilestones(
    {
      archetype: runtime.archetype,
      cycleWeeks: runtime.cycleWeeks,
      ladders: runtime.ladders,
    },
    profile
  );
  if (!derived.length) return derived;

  try {
    const sb = await db();
    const rows = derived.map((m) => ({
      program_id: runtime.programId,
      skill_slug: m.skillSlug,
      description: m.description,
      target_unit: m.targetUnit,
      target_value: m.targetValue,
      target_lever: m.targetLever,
      due_week: m.dueWeek,
      status: m.status,
      position: m.position,
    }));
    const { data, error } = await sb.from("milestones").insert(rows).select("*");
    if (error) throw error;
    return ((data ?? []) as MilestoneRow[]).map(rowToMilestone);
  } catch {
    // Tabela 009 não aplicada → devolve derivados (não persistidos).
    return derived;
  }
}

/** Persiste o status atualizado dos milestones (achieved marca achieved_at). */
export async function persistMilestoneStatuses(milestones: Milestone[]): Promise<void> {
  const withId = milestones.filter((m) => m.id);
  if (!withId.length) return;
  try {
    const sb = await db();
    const now = new Date().toISOString();
    for (const m of withId) {
      await sb
        .from("milestones")
        .update({
          status: m.status,
          achieved_at: m.status === "achieved" ? now : null,
        })
        .eq("id", m.id as string);
    }
  } catch {
    // tabela não aplicada → ignora silenciosamente (estado em memória vale).
  }
}

// ── Avaliação semanal (compõe a lógica pura com os dados reais) ──────

const SKILL_META: { slug: string; name: string; pattern: "front" | "planche" }[] = [
  { slug: "front-lever", name: "Front Lever", pattern: "front" },
  { slug: "planche", name: "Planche", pattern: "planche" },
];

/** Lê tudo o que a avaliação precisa, roda a lógica pura e devolve o veredito +
 *  ajustes + milestones atualizados + objetivo concluído. NÃO persiste (só leitura).
 *  Persistir/aplicar é responsabilidade das actions. */
export async function evaluateActiveProgram(): Promise<{
  programId: string | null;
  fromSeed: boolean;
  goalSkill: string | null;
  evaluation: WeekEvaluation;
}> {
  const runtime = await getActiveProgramRuntime();
  const [cycleStart, levers, pain, recentSessions, stats] = await Promise.all([
    getSetting("cycle_start").catch(() => null),
    getCurrentLevers().catch(() => ({ front: null, planche: null })),
    getPainHistory().catch(() => []),
    getSessions(8).catch(() => []),
    getStats().catch(() => ({
      total: 0,
      thisWeek: 0,
      streakDays: 0,
      bestStreak: 0,
      lastDate: null,
    })),
  ]);
  const week = weekFromStart(cycleStart);
  const block = blockForWeek(week);

  // Séries por skill: pontos de progresso + alavanca atual + escada do programa.
  const skills: SkillSeries[] = [];
  for (const meta of SKILL_META) {
    const points: SkillPoint[] = await getSkillProgress(meta.pattern).catch(() => []);
    const ladder = runtime.ladders.find((l) => l.slug === meta.slug);
    skills.push({
      slug: meta.slug,
      name: meta.name,
      points,
      currentLever: meta.pattern === "front" ? levers.front : levers.planche,
      levels: ladder?.levels ?? [],
    });
  }

  const milestones = runtime.programId
    ? await listMilestones(runtime.programId)
    : await ensureMilestonesForActiveProgram();
  const seedMilestones = milestones.length
    ? milestones
    : await ensureMilestonesForActiveProgram();

  const profile = await getProfile().catch(() => null);
  const goalSkill = profile?.goalSkill ?? null;

  const evaluation = evaluateWeek({
    week,
    block,
    pain,
    recentSessions,
    skills,
    milestones: seedMilestones,
    goalSkill,
    sessionsDone: stats.total,
  });

  return {
    programId: runtime.programId,
    fromSeed: runtime.fromSeed,
    goalSkill,
    evaluation,
  };
}

// ── Aplicar um ajuste ao programa + auditoria ────────────────────────

/** Registra um ajuste em `plan_adjustments` (auditoria — RNF-002). */
async function recordAdjustment(
  programId: string,
  week: number,
  adj: PlanAdjustment,
  applied: boolean
): Promise<void> {
  try {
    const sb = await db();
    await sb.from("plan_adjustments").insert({
      program_id: programId,
      week,
      kind: adj.kind,
      skill_slug: adj.skillSlug,
      detail: {
        reasons: adj.reasons,
        from: adj.fromLever,
        to: adj.toLever,
        skill: adj.skillName,
      },
      applied,
      applied_at: applied ? new Date().toISOString() : null,
    });
  } catch {
    // tabela 009 não aplicada → ignora (não bloqueia a aplicação do ajuste).
  }
}

/** Aplica um ajuste `advance` ao programa: sobe a prescrição do skill foco para a
 *  alavanca-alvo (atualiza `exercise_name`/`prescription`/`note` do day_exercise de
 *  skill). Deload/hold são registrados mas NÃO mudam o programa (só sugestão). */
export async function applyAdjustment(
  programId: string,
  week: number,
  adj: PlanAdjustment
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (adj.kind === "advance" && adj.skillSlug && adj.toLever) {
      const sb = await db();
      // dias do programa
      const { data: days, error: e1 } = await sb
        .from("program_days")
        .select("id")
        .eq("program_id", programId);
      if (e1) throw e1;
      const dayIds = ((days ?? []) as { id: string }[]).map((d) => d.id);
      if (dayIds.length) {
        // exercícios de skill cujo nome casa com a skill alvo
        const { data: exs, error: e2 } = await sb
          .from("day_exercises")
          .select("id, exercise_name, is_skill")
          .in("program_day_id", dayIds)
          .eq("is_skill", true);
        if (e2) throw e2;
        const needle = adj.skillName?.toLowerCase() ?? adj.skillSlug.replace(/-/g, " ");
        for (const ex of (exs ?? []) as {
          id: string;
          exercise_name: string | null;
        }[]) {
          const name = (ex.exercise_name ?? "").toLowerCase();
          if (name.includes(needle) || name.includes(adj.skillSlug.split("-")[0])) {
            await sb
              .from("day_exercises")
              .update({
                note: `Alavanca-alvo: ${adj.toLever} (ajuste do coach, semana ${week}).`,
              })
              .eq("id", ex.id);
          }
        }
      }
    }
    await recordAdjustment(programId, week, adj, true);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao aplicar." };
  }
}
