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
}

export interface WorkoutInput {
  date: string;
  dayCode: string;
  week?: number | null;
  block?: string | null;
  elbowPain?: number | null;
  lowerBack?: number | null;
  notes?: string | null;
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
    }));

  const id = await insertWorkout(session, entries);
  revalidateAll();
  return { id };
}

// ---------- Coach IA (OpenAI) ----------
export async function runAiCoach(): Promise<
  { ok: true; text: string } | { ok: false; error: string }
> {
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

export async function saveSettings(formData: FormData) {
  const start = str(formData.get("cycle_start"));
  if (start) await setSetting("cycle_start", start);
  revalidatePath("/");
  redirect("/");
}
