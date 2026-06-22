import "server-only";
import { createClient } from "./supabase-server";

// Cliente Supabase por-request (RLS por auth.uid()). Cada acesso pega a sessão
// dos cookies; o filtro por usuário é garantido pelo RLS no banco.
export const db = createClient;

// ---------- Settings ----------
export async function getSetting(key: string): Promise<string | null> {
  const sb = await db();
  const { data, error } = await sb
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return (data?.value as string | undefined) ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const sb = await db();
  // user_id é preenchido pelo default auth.uid(); conflito é por (user_id, key)
  const { error } = await sb
    .from("settings")
    .upsert({ key, value }, { onConflict: "user_id,key" });
  if (error) throw error;
}

// ---------- Escrita de treino ----------
export interface SessionInsert {
  date: string;
  day_code: string;
  week: number | null;
  block: string | null;
  elbow_pain: number | null;
  lower_back: number | null;
  notes: string | null;
  created_at: string;
}

export interface EntryInsert {
  exercise: string;
  category: string | null;
  is_skill: number;
  lever: string | null;
  max_hold_s: number | null;
  sets: number | null;
  reps_or_time: string | null;
  rir: string | null;
  done: number;
  notes: string | null;
  position: number;
  // FKs do programa (003/004). NULLABLE: histórico/semente continuam válidos.
  program_day_id?: string | null;
  day_exercise_id?: string | null;
}

/** Insere a sessão e suas entradas. Se as entradas falharem, remove a sessão.
 *  user_id é preenchido automaticamente pelo default auth.uid() no banco. */
export async function insertWorkout(
  s: SessionInsert,
  entries: EntryInsert[]
): Promise<number> {
  const sb = await db();
  const { data, error } = await sb
    .from("sessions")
    .insert(s)
    .select("id")
    .single();
  if (error) throw error;
  const id = data.id as number;

  const valid = entries.filter((e) => e.exercise && e.exercise.trim());
  if (valid.length) {
    // Só inclui as colunas de FK do programa quando há vínculo real. Assim, se a
    // migração 003 ainda não estiver aplicada (colunas inexistentes), o insert da
    // semente não tenta escrever nelas e não quebra. (R8: FKs nullable.)
    const hasProgramLink = valid.some((e) => e.program_day_id || e.day_exercise_id);
    const rows = valid.map((e) => {
      const base: Record<string, unknown> = { ...e, session_id: id };
      if (hasProgramLink) {
        base.program_day_id = e.program_day_id ?? null;
        base.day_exercise_id = e.day_exercise_id ?? null;
      } else {
        delete base.program_day_id;
        delete base.day_exercise_id;
      }
      return base;
    });
    const { error: e2 } = await sb.from("entries").insert(rows);
    if (e2) {
      await sb.from("sessions").delete().eq("id", id);
      throw e2;
    }
  }
  return id;
}

export async function removeSession(id: number): Promise<void> {
  const sb = await db();
  // entries são apagadas em cascata pela FK (ON DELETE CASCADE)
  const { error } = await sb.from("sessions").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Tipos ----------
export interface SessionRow {
  id: number;
  date: string;
  day_code: string;
  week: number | null;
  block: string | null;
  elbow_pain: number | null;
  lower_back: number | null;
  notes: string | null;
  created_at: string;
}

export interface EntryRow {
  id: number;
  session_id: number;
  exercise: string;
  category: string | null;
  is_skill: number;
  lever: string | null;
  max_hold_s: number | null;
  sets: number | null;
  reps_or_time: string | null;
  rir: string | null;
  done: number;
  notes: string | null;
  position: number;
}

// ---------- Matchers de skill (espelham os LIKE do SQL antigo) ----------
export function matchFront(exercise: string, lever: string | null): boolean {
  const ex = exercise.toLowerCase();
  return ex.includes("front") || exercise.includes("FL") || (!!lever && lever.includes("FL"));
}
export function matchPlanche(exercise: string, lever: string | null): boolean {
  const ex = exercise.toLowerCase();
  return ex.includes("planche") || (!!lever && lever.toLowerCase().includes("lanche"));
}
