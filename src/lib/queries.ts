import {
  db,
  matchFront,
  matchPlanche,
  type EntryRow,
  type SessionRow,
} from "./db";

// Mapa session_id -> date (evita depender de "embeds"/FK da API; join em JS).
async function sessionDateMap(): Promise<Map<number, string>> {
  const sb = await db();
  const { data, error } = await sb.from("sessions").select("id, date");
  if (error) throw error;
  const m = new Map<number, string>();
  for (const r of (data ?? []) as { id: number; date: string }[]) m.set(r.id, r.date);
  return m;
}

export async function getSessions(limit?: number): Promise<SessionRow[]> {
  const sb = await db();
  let qb = sb
    .from("sessions")
    .select("*")
    .order("date", { ascending: false })
    .order("id", { ascending: false });
  if (limit) qb = qb.limit(limit);
  const { data, error } = await qb;
  if (error) throw error;
  return (data ?? []) as SessionRow[];
}

export async function getSession(id: number): Promise<SessionRow | undefined> {
  const sb = await db();
  const { data, error } = await sb
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? undefined) as SessionRow | undefined;
}

export async function getEntries(sessionId: number): Promise<EntryRow[]> {
  const sb = await db();
  const { data, error } = await sb
    .from("entries")
    .select("*")
    .eq("session_id", sessionId)
    .order("position", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EntryRow[];
}

export interface SessionWithCount extends SessionRow {
  entry_count: number;
  skill_summary: string | null;
}

interface MiniEntry {
  session_id: number;
  lever: string | null;
  max_hold_s: number | null;
  is_skill: number;
}

export async function getSessionsWithSummary(
  limit?: number
): Promise<SessionWithCount[]> {
  const sb = await db();
  let qb = sb
    .from("sessions")
    .select("*")
    .order("date", { ascending: false })
    .order("id", { ascending: false });
  if (limit) qb = qb.limit(limit);
  const { data, error } = await qb;
  if (error) throw error;
  const list = (data ?? []) as SessionRow[];
  if (!list.length) return [];

  const ids = list.map((s) => s.id);
  const { data: ents, error: e2 } = await sb
    .from("entries")
    .select("session_id, lever, max_hold_s, is_skill")
    .in("session_id", ids);
  if (e2) throw e2;

  const byS = new Map<number, MiniEntry[]>();
  for (const e of (ents ?? []) as MiniEntry[]) {
    const arr = byS.get(e.session_id) ?? [];
    arr.push(e);
    byS.set(e.session_id, arr);
  }

  return list.map((s) => {
    const es = byS.get(s.id) ?? [];
    const parts = es
      .filter((e) => e.is_skill === 1 && e.lever)
      .map((e) => `${e.lever} ${e.max_hold_s ?? ""}s`);
    return {
      ...s,
      entry_count: es.length,
      skill_summary: parts.length ? parts.join(" · ") : null,
    };
  });
}

export interface SkillPoint {
  date: string;
  max_hold_s: number;
  lever: string | null;
  exercise: string;
  session_id: number;
}

interface SkillEntry {
  max_hold_s: number | null;
  lever: string | null;
  exercise: string;
  session_id: number;
}

export async function getSkillProgress(
  pattern: "front" | "planche"
): Promise<SkillPoint[]> {
  const sb = await db();
  const [entsRes, dateMap] = await Promise.all([
    sb
      .from("entries")
      .select("max_hold_s, lever, exercise, session_id")
      .eq("is_skill", 1)
      .not("max_hold_s", "is", null),
    sessionDateMap(),
  ]);
  if (entsRes.error) throw entsRes.error;
  const match = pattern === "front" ? matchFront : matchPlanche;
  return ((entsRes.data ?? []) as SkillEntry[])
    .filter((r) => match(r.exercise, r.lever))
    .map((r) => ({
      date: dateMap.get(r.session_id) ?? "",
      max_hold_s: r.max_hold_s as number,
      lever: r.lever,
      exercise: r.exercise,
      session_id: r.session_id,
    }))
    .filter((p) => p.date)
    .sort((a, b) => a.date.localeCompare(b.date) || a.session_id - b.session_id);
}

export interface PainPoint {
  date: string;
  elbow_pain: number | null;
  lower_back: number | null;
  day_code: string;
}

export async function getPainHistory(): Promise<PainPoint[]> {
  const sb = await db();
  const { data, error } = await sb
    .from("sessions")
    .select("date, elbow_pain, lower_back, day_code, id")
    .order("date", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as (PainPoint & { id: number })[])
    .filter((r) => r.elbow_pain !== null || r.lower_back !== null)
    .map((r) => ({
      date: r.date,
      elbow_pain: r.elbow_pain,
      lower_back: r.lower_back,
      day_code: r.day_code,
    }));
}

export interface Stats {
  total: number;
  thisWeek: number;
  streakDays: number;
  bestStreak: number;
  lastDate: string | null;
}

export async function getStats(): Promise<Stats> {
  const sb = await db();
  const totalRes = await sb
    .from("sessions")
    .select("*", { count: "exact", head: true });
  if (totalRes.error) throw totalRes.error;
  const total = totalRes.count ?? 0;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const iso = sevenDaysAgo.toISOString().slice(0, 10);
  const weekRes = await sb
    .from("sessions")
    .select("*", { count: "exact", head: true })
    .gte("date", iso);
  if (weekRes.error) throw weekRes.error;
  const thisWeek = weekRes.count ?? 0;

  const datesRes = await sb.from("sessions").select("date");
  if (datesRes.error) throw datesRes.error;
  const allDates = ((datesRes.data ?? []) as { date: string }[]).map((r) => r.date);
  const dates = [...new Set(allDates)];

  const set = new Set(dates);
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!set.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const sorted = [...dates].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const d of sorted) {
    const cur = new Date(d + "T00:00:00");
    if (prev) {
      const diff = Math.round((cur.getTime() - prev.getTime()) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = cur;
  }

  return {
    total,
    thisWeek,
    streakDays: streak,
    bestStreak: Math.max(best, streak),
    lastDate: sorted.length ? sorted[sorted.length - 1] : null,
  };
}

export async function getCurrentLevers(): Promise<{
  front: string | null;
  planche: string | null;
}> {
  const sb = await db();
  const [entsRes, dateMap] = await Promise.all([
    sb
      .from("entries")
      .select("lever, exercise, session_id")
      .eq("is_skill", 1)
      .not("lever", "is", null),
    sessionDateMap(),
  ]);
  if (entsRes.error) throw entsRes.error;
  const rows = ((entsRes.data ?? []) as SkillEntry[])
    .map((r) => ({
      lever: r.lever,
      exercise: r.exercise,
      session_id: r.session_id,
      date: dateMap.get(r.session_id) ?? "",
    }))
    .filter((r) => r.date);
  const latest = (pred: (ex: string, lv: string | null) => boolean) =>
    rows
      .filter((r) => pred(r.exercise, r.lever))
      .sort((a, b) => b.date.localeCompare(a.date) || b.session_id - a.session_id)[0]
      ?.lever ?? null;
  return { front: latest(matchFront), planche: latest(matchPlanche) };
}

export interface CoachData {
  front: SkillPoint[];
  planche: SkillPoint[];
  pain: PainPoint[];
  recentSessions: SessionRow[];
}

export async function getCoachData(): Promise<CoachData> {
  const [front, planche, pain, recentSessions] = await Promise.all([
    getSkillProgress("front"),
    getSkillProgress("planche"),
    getPainHistory(),
    getSessions(8),
  ]);
  return { front, planche, pain, recentSessions };
}

export async function getBestHolds(): Promise<{
  front: number | null;
  planche: number | null;
}> {
  const sb = await db();
  const { data, error } = await sb
    .from("entries")
    .select("exercise, lever, max_hold_s")
    .eq("is_skill", 1);
  if (error) throw error;
  const rows = (data ?? []) as {
    exercise: string;
    lever: string | null;
    max_hold_s: number | null;
  }[];
  const maxOf = (pred: (ex: string, lv: string | null) => boolean) => {
    const vals = rows
      .filter((r) => r.max_hold_s !== null && pred(r.exercise, r.lever))
      .map((r) => r.max_hold_s as number);
    return vals.length ? Math.max(...vals) : null;
  };
  return { front: maxOf(matchFront), planche: maxOf(matchPlanche) };
}
