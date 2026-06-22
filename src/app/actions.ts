"use server";

import { db, setSetting } from "@/lib/db";
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

export async function saveSession(formData: FormData) {
  const date = str(formData.get("date")) ?? new Date().toISOString().slice(0, 10);
  const dayCode = str(formData.get("day_code")) ?? "D1";
  const week = num(formData.get("week"));
  const block = str(formData.get("block"));
  const elbow = num(formData.get("elbow_pain"));
  const lowerBack = num(formData.get("lower_back"));
  const notes = str(formData.get("notes"));
  const now = new Date().toISOString();

  // Entradas chegam como arrays indexados: ex_name[], lever[], etc.
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

  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO sessions (date, day_code, week, block, elbow_pain, lower_back, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(date, dayCode, week, block, elbow, lowerBack, notes, now);
    const sessionId = Number(info.lastInsertRowid);

    const stmt = db.prepare(
      `INSERT INTO entries
        (session_id, exercise, category, is_skill, lever, max_hold_s, sets, reps_or_time, rir, done, notes, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (let i = 0; i < names.length; i++) {
      const name = names[i]?.trim();
      if (!name) continue;
      stmt.run(
        sessionId,
        name,
        cats[i] ?? null,
        isSkills[i] === "1" ? 1 : 0,
        levers[i]?.trim() || null,
        maxHolds[i] ? Number(maxHolds[i]) : null,
        sets[i] ? Number(sets[i]) : null,
        repsTime[i]?.trim() || null,
        rirs[i]?.trim() || null,
        dones[i] === "0" ? 0 : 1,
        exNotes[i]?.trim() || null,
        i
      );
    }
    return sessionId;
  });

  const sessionId = tx();
  revalidatePath("/");
  revalidatePath("/historico");
  revalidatePath("/progressao");
  redirect(`/historico/${sessionId}`);
}

export async function deleteSession(formData: FormData) {
  const id = num(formData.get("id"));
  if (id !== null) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  }
  revalidatePath("/");
  revalidatePath("/historico");
  revalidatePath("/progressao");
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
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO sessions (date, day_code, week, block, elbow_pain, lower_back, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.date,
        data.dayCode,
        data.week ?? null,
        data.block ?? null,
        data.elbowPain ?? null,
        data.lowerBack ?? null,
        data.notes ?? null,
        now
      );
    const sessionId = Number(info.lastInsertRowid);
    const stmt = db.prepare(
      `INSERT INTO entries
        (session_id, exercise, category, is_skill, lever, max_hold_s, sets, reps_or_time, rir, done, notes, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    data.entries.forEach((e, i) => {
      if (!e.exercise?.trim()) return;
      stmt.run(
        sessionId,
        e.exercise.trim(),
        e.category ?? null,
        e.isSkill ? 1 : 0,
        e.lever?.trim() || null,
        e.maxHold ?? null,
        e.sets ?? null,
        e.repsOrTime?.trim() || null,
        e.rir?.trim() || null,
        e.done === false ? 0 : 1,
        e.notes?.trim() || null,
        i
      );
    });
    return sessionId;
  });
  const id = tx();
  revalidatePath("/");
  revalidatePath("/historico");
  revalidatePath("/progressao");
  revalidatePath("/coach");
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

  const data = getCoachData();
  const week = weekFromStart(getSetting("cycle_start"));
  const block = blockForWeek(week);
  const report = buildReport({ ...data, block });
  return analyzeWithAI(data, report);
}

export async function saveSettings(formData: FormData) {
  const start = str(formData.get("cycle_start"));
  if (start) setSetting("cycle_start", start);
  revalidatePath("/");
  redirect("/");
}
