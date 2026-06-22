"use server";

import {
  setSetting,
  insertWorkout,
  removeSession,
  type SessionInsert,
  type EntryInsert,
} from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RoutineInput } from "@/lib/routine";

function num(v: FormDataEntryValue | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function str(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/historico");
  revalidatePath("/progressao");
  revalidatePath("/coach");
}

export async function saveSession(formData: FormData) {
  const session: SessionInsert = {
    date: str(formData.get("date")) ?? new Date().toISOString().slice(0, 10),
    day_code: str(formData.get("day_code")) ?? "D1",
    week: num(formData.get("week")),
    block: str(formData.get("block")),
    elbow_pain: num(formData.get("elbow_pain")),
    lower_back: num(formData.get("lower_back")),
    notes: str(formData.get("notes")),
    created_at: new Date().toISOString(),
  };

  // Entradas chegam como arrays indexados: ex_name[], ex_lever[], etc.
  const names = formData.getAll("ex_name").map(String);
  const cats = formData.getAll("ex_category").map(String);
  const isSkills = formData.getAll("ex_is_skill").map(String);
  const levers = formData.getAll("ex_lever").map(String);
  const maxHolds = formData.getAll("ex_max_hold").map(String);
  const sets = formData.getAll("ex_sets").map(String);
  const repsTime = formData.getAll("ex_reps_or_time").map(String);
  const rirs = formData.getAll("ex_rir").map(String);
  const dones = formData.getAll("ex_done").map(String);
  const exNotes = formData.getAll("ex_notes").map(String);
  const dayExerciseIds = formData.getAll("ex_day_exercise_id").map(String);
  const programDayId = str(formData.get("program_day_id"));

  const entries: EntryInsert[] = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i]?.trim();
    if (!name) continue;
    entries.push({
      exercise: name,
      category: cats[i] ?? null,
      is_skill: isSkills[i] === "1" ? 1 : 0,
      lever: levers[i]?.trim() || null,
      max_hold_s: maxHolds[i] ? Number(maxHolds[i]) : null,
      sets: sets[i] ? Number(sets[i]) : null,
      reps_or_time: repsTime[i]?.trim() || null,
      rir: rirs[i]?.trim() || null,
      done: dones[i] === "0" ? 0 : 1,
      notes: exNotes[i]?.trim() || null,
      position: i,
      program_day_id: programDayId,
      day_exercise_id: dayExerciseIds[i]?.trim() || null,
    });
  }

  const sessionId = await insertWorkout(session, entries);
  revalidateAll();
  redirect(`/historico/${sessionId}`);
}

export async function deleteSession(formData: FormData) {
  const id = num(formData.get("id"));
  if (id !== null) await removeSession(id);
  revalidateAll();
  redirect("/historico");
}

// ---------- Modo de treino guiado (payload estruturado) ----------
export interface WorkoutEntryInput {
  exercise: string;
  category: string | null;
  isSkill: boolean;
  lever?: string | null;
  maxHold?: number | null;
  sets?: number | null;
  repsOrTime?: string | null;
  rir?: string | null;
  done?: boolean;
  notes?: string | null;
  /** FK p/ o exercício do programa (003/004); null quando vem da semente. */
  dayExerciseId?: string | null;
}

export interface WorkoutInput {
  date: string;
  dayCode: string;
  week?: number | null;
  block?: string | null;
  elbowPain?: number | null;
  lowerBack?: number | null;
  notes?: string | null;
  /** FK p/ o dia do programa (003/004); null quando vem da semente. */
  programDayId?: string | null;
  entries: WorkoutEntryInput[];
}

export async function saveWorkout(data: WorkoutInput): Promise<{ id: number }> {
  const session: SessionInsert = {
    date: data.date,
    day_code: data.dayCode,
    week: data.week ?? null,
    block: data.block ?? null,
    elbow_pain: data.elbowPain ?? null,
    lower_back: data.lowerBack ?? null,
    notes: data.notes ?? null,
    created_at: new Date().toISOString(),
  };
  const entries: EntryInsert[] = data.entries
    .filter((e) => e.exercise?.trim())
    .map((e, i) => ({
      exercise: e.exercise.trim(),
      category: e.category ?? null,
      is_skill: e.isSkill ? 1 : 0,
      lever: e.lever?.trim() || null,
      max_hold_s: e.maxHold ?? null,
      sets: e.sets ?? null,
      reps_or_time: e.repsOrTime?.trim() || null,
      rir: e.rir?.trim() || null,
      done: e.done === false ? 0 : 1,
      notes: e.notes?.trim() || null,
      position: i,
      program_day_id: data.programDayId ?? null,
      day_exercise_id: e.dayExerciseId ?? null,
    }));

  const id = await insertWorkout(session, entries);
  revalidateAll();
  return { id };
}

// ---------- Coach IA (OpenAI) ----------
export async function runAiCoach(): Promise<
  { ok: true; text: string } | { ok: false; error: string } | { ok: false; upgrade: true; error: string }
> {
  // 010: gate server-side (RNF-001). A análise por IA é feature Pro; o client
  // não consegue burlar — a checagem acontece aqui, antes de qualquer chamada.
  const { requireFeature } = await import("@/lib/billing");
  const gate = await requireFeature("ai_coach");
  if (!gate.allowed) return { ok: false, upgrade: true, error: gate.reason };

  const { getCoachData } = await import("@/lib/queries");
  const { buildReport } = await import("@/lib/coach");
  const { analyzeWithAI } = await import("@/lib/ai");
  const { getSetting } = await import("@/lib/db");
  const { weekFromStart, blockForWeek } = await import("@/lib/cycle");

  const data = await getCoachData();
  const week = weekFromStart(await getSetting("cycle_start"));
  const block = blockForWeek(week);
  const report = buildReport({ ...data, block });
  return analyzeWithAI(data, report);
}

// ---------- 010: Billing (Stripe checkout / portal) ----------

/** Inicia o checkout do Stripe para o plano escolhido (mensal/anual). Cria/reusa
 *  o customer, grava o stripe_customer_id e redireciona para a sessão de checkout.
 *  Human-gated: sem chaves/PRICE_IDs (ou sem o pacote `stripe`), devolve erro
 *  legível — a página de billing mostra o estado "indisponível". */
export async function startCheckout(
  plan: "monthly" | "annual"
): Promise<{ ok: false; error: string }> {
  const { getStripe, getStripeConfig } = await import("@/lib/stripe");
  const cfg = getStripeConfig();
  const stripe = await getStripe();
  if (!stripe) return { ok: false, error: "Pagamento indisponível: Stripe não configurado." };

  const priceId = plan === "annual" ? cfg.priceAnnual : cfg.priceMonthly;
  if (!priceId) return { ok: false, error: "Plano indisponível: PRICE_ID não configurado." };
  if (!cfg.appUrl) return { ok: false, error: "NEXT_PUBLIC_APP_URL não configurado." };

  const { createClient } = await import("@/lib/supabase-server");
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Faça login para assinar." };

  const { getOrCreateCustomerId } = await import("@/lib/billing-io");
  let customerId: string;
  try {
    customerId = await getOrCreateCustomerId(stripe, user.id, user.email ?? undefined);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao preparar o checkout." };
  }

  let url: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      subscription_data: { metadata: { user_id: user.id } },
      success_url: `${cfg.appUrl}/billing?status=success`,
      cancel_url: `${cfg.appUrl}/billing?status=cancel`,
    });
    url = session.url;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao criar o checkout." };
  }
  if (!url) return { ok: false, error: "Stripe não retornou a URL de checkout." };
  redirect(url);
}

/** Abre o Customer Portal do Stripe para gerenciar/cancelar a assinatura. */
export async function openBillingPortal(): Promise<{ ok: false; error: string }> {
  const { getStripe, getStripeConfig } = await import("@/lib/stripe");
  const cfg = getStripeConfig();
  const stripe = await getStripe();
  if (!stripe) return { ok: false, error: "Pagamento indisponível: Stripe não configurado." };
  if (!cfg.appUrl) return { ok: false, error: "NEXT_PUBLIC_APP_URL não configurado." };

  const { getCustomerId } = await import("@/lib/billing-io");
  const customerId = await getCustomerId();
  if (!customerId) return { ok: false, error: "Nenhuma assinatura encontrada para gerenciar." };

  let url: string;
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${cfg.appUrl}/billing`,
    });
    url = session.url;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao abrir o portal." };
  }
  redirect(url);
}

export async function saveSettings(formData: FormData) {
  const start = str(formData.get("cycle_start"));
  if (start) await setSetting("cycle_start", start);
  revalidatePath("/");
  redirect("/");
}

// ---------- 006: Builder manual & exercício custom ----------

/** Cria/reutiliza um exercício custom do usuário (006 / T-002). Retornado ao
 *  picker no client; portão real (migração 003/005) é humano — se não aplicada,
 *  a chamada lança e o picker mantém só a opção de nome livre. */
export async function createCustomExerciseAction(input: {
  name: string;
  category?: string | null;
  isSkill?: boolean;
}): Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }> {
  const { createCustomExercise } = await import("@/lib/programs");
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Informe um nome." };
  try {
    const ex = await createCustomExercise({
      name,
      category: input.category ?? null,
      isSkill: input.isSkill,
    });
    return { ok: true, id: ex.id, name: ex.name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao criar." };
  }
}

// ---------- 009: Loop adaptativo (milestones + ajustes) ----------

/** Aplica um ajuste proposto pelo coach ao programa ativo e registra a auditoria
 *  (009 / T-005). O ajuste vem serializado do client; reconstrói o PlanAdjustment.
 *  Portão humano: se as tabelas 009/003 não estiverem aplicadas, o IO tolera e
 *  retorna ok sem mudar o banco (estado em memória). */
export async function applyPlanAdjustment(input: {
  programId: string;
  week: number;
  kind: "advance" | "hold" | "deload" | "volume";
  skillSlug: string | null;
  skillName: string | null;
  reasons: string[];
  fromLever: string | null;
  toLever: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { applyAdjustment } = await import("@/lib/progression-io");
  try {
    const res = await applyAdjustment(input.programId, input.week, {
      kind: input.kind,
      skillSlug: input.skillSlug,
      skillName: input.skillName,
      reasons: input.reasons,
      fromLever: input.fromLever,
      toLever: input.toLever,
    });
    if (res.ok) {
      revalidatePath("/coach");
      revalidatePath("/treinar");
      revalidatePath("/plano");
    }
    return res;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao aplicar." };
  }
}

/** Fecha o loop de objetivo (009 / T-007): persiste os milestones atingidos e
 *  encaminha o usuário para definir o próximo objetivo (onboarding/anamnese → 007/008). */
export async function completeGoalAndStartNext(): Promise<void> {
  const { evaluateActiveProgram, persistMilestoneStatuses } = await import(
    "@/lib/progression-io"
  );
  try {
    const { evaluation } = await evaluateActiveProgram();
    await persistMilestoneStatuses(evaluation.milestones);
  } catch {
    // tolera ausência das tabelas 009 — segue para o onboarding mesmo assim.
  }
  revalidateAll();
  redirect("/onboarding");
}

/** Persiste uma rotina manual como `program` (source=manual) com dias/exercícios
 *  e, opcionalmente, ativa-a (006 / T-004). Toda a validação/normalização é pura
 *  (buildRoutineDraft); aqui só fazemos o IO. */
export async function saveRoutine(
  input: RoutineInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { buildRoutineDraft } = await import("@/lib/routine");
  const built = buildRoutineDraft(input);
  if (!built.ok) return built;

  const { insertProgramDraft } = await import("@/lib/programs");
  try {
    const program = await insertProgramDraft(built.draft);
    revalidateAll();
    revalidatePath("/montar");
    revalidatePath("/treinar");
    return { ok: true, id: program.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao salvar." };
  }
}
