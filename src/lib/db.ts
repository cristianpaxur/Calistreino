import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Acesso ao Supabase pela API (PostgREST) sobre HTTPS — sem conexão TCP direta.
// Use a service_role key (server-only): todo acesso é feito no servidor.
function makeClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_KEY ??
    process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase não configurado: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Cliente lazy + singleton (importar o módulo nunca conecta nem lança).
const globalForDb = globalThis as unknown as { __supa?: SupabaseClient };
let real: SupabaseClient | null = globalForDb.__supa ?? null;
export function supa(): SupabaseClient {
  if (!real) {
    real = makeClient();
    globalForDb.__supa = real;
  }
  return real;
}

// ---------- Settings ----------
export async function getSetting(key: string): Promise<string | null> {
  const { data, error } = await supa()
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return (data?.value as string | undefined) ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const { error } = await supa()
    .from("settings")
    .upsert({ key, value }, { onConflict: "key" });
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
}

/** Insere a sessão e suas entradas. Se as entradas falharem, remove a sessão. */
export async function insertWorkout(
  s: SessionInsert,
  entries: EntryInsert[]
): Promise<number> {
  const { data, error } = await supa()
    .from("sessions")
    .insert(s)
    .select("id")
    .single();
  if (error) throw error;
  const id = data.id as number;

  const valid = entries.filter((e) => e.exercise && e.exercise.trim());
  if (valid.length) {
    const rows = valid.map((e) => ({ ...e, session_id: id }));
    const { error: e2 } = await supa().from("entries").insert(rows);
    if (e2) {
      await supa().from("sessions").delete().eq("id", id);
      throw e2;
    }
  }
  return id;
}

export async function removeSession(id: number): Promise<void> {
  // entries são apagadas em cascata pela FK (ON DELETE CASCADE)
  const { error } = await supa().from("sessions").delete().eq("id", id);
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
