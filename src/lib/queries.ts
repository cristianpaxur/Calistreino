import { sql, ensureSchema, EntryRow, SessionRow } from "./db";

export async function getSessions(limit?: number): Promise<SessionRow[]> {
  await ensureSchema();
  const rows = limit
    ? await sql`SELECT * FROM sessions ORDER BY date DESC, id DESC LIMIT ${limit}`
    : await sql`SELECT * FROM sessions ORDER BY date DESC, id DESC`;
  return rows as SessionRow[];
}

export async function getSession(id: number): Promise<SessionRow | undefined> {
  await ensureSchema();
  const rows = (await sql`SELECT * FROM sessions WHERE id = ${id}`) as SessionRow[];
  return rows[0];
}

export async function getEntries(sessionId: number): Promise<EntryRow[]> {
  await ensureSchema();
  const rows =
    await sql`SELECT * FROM entries WHERE session_id = ${sessionId} ORDER BY position, id`;
  return rows as EntryRow[];
}

export interface SessionWithCount extends SessionRow {
  entry_count: number;
  skill_summary: string | null;
}

export async function getSessionsWithSummary(
  limit?: number
): Promise<SessionWithCount[]> {
  await ensureSchema();
  const base = `
    SELECT s.*,
      (SELECT COUNT(*)::int FROM entries e WHERE e.session_id = s.id) AS entry_count,
      (SELECT string_agg(e.lever || ' ' || COALESCE(e.max_hold_s::text,'') || 's', ' · ')
         FROM entries e WHERE e.session_id = s.id AND e.is_skill = 1 AND e.lever IS NOT NULL) AS skill_summary
    FROM sessions s
    ORDER BY s.date DESC, s.id DESC`;
  const rows = limit
    ? await sql.query(base + ` LIMIT $1`, [limit])
    : await sql.query(base);
  return rows as SessionWithCount[];
}

export interface SkillPoint {
  date: string;
  max_hold_s: number;
  lever: string | null;
  exercise: string;
  session_id: number;
}

/** Histórico de max-hold por padrão de skill (FL ou Planche) para gráficos. */
export async function getSkillProgress(
  pattern: "front" | "planche"
): Promise<SkillPoint[]> {
  await ensureSchema();
  const like = pattern === "front" ? "%front%" : "%planche%";
  const fallback = pattern === "front" ? "%FL%" : "%planche%";
  const third = pattern === "front" ? "%FL%" : "%Planche%";
  const rows = await sql`
    SELECT s.date AS date, e.max_hold_s AS max_hold_s, e.lever AS lever,
           e.exercise AS exercise, s.id AS session_id
      FROM entries e JOIN sessions s ON s.id = e.session_id
     WHERE e.is_skill = 1 AND e.max_hold_s IS NOT NULL
       AND (lower(e.exercise) LIKE ${like} OR e.lever LIKE ${fallback} OR e.exercise LIKE ${third})
     ORDER BY s.date ASC, s.id ASC`;
  return rows as SkillPoint[];
}

export interface PainPoint {
  date: string;
  elbow_pain: number | null;
  lower_back: number | null;
  day_code: string;
}

export async function getPainHistory(): Promise<PainPoint[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT date, elbow_pain, lower_back, day_code FROM sessions
     WHERE elbow_pain IS NOT NULL OR lower_back IS NOT NULL
     ORDER BY date ASC, id ASC`;
  return rows as PainPoint[];
}

export interface Stats {
  total: number;
  thisWeek: number;
  streakDays: number;
  bestStreak: number;
  lastDate: string | null;
}

export async function getStats(): Promise<Stats> {
  await ensureSchema();
  const totalRows = (await sql`SELECT COUNT(*)::int AS c FROM sessions`) as {
    c: number;
  }[];
  const total = totalRows[0].c;

  const lastRows = (await sql`SELECT date FROM sessions ORDER BY date DESC, id DESC LIMIT 1`) as {
    date: string;
  }[];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const iso = sevenDaysAgo.toISOString().slice(0, 10);
  const weekRows = (await sql`SELECT COUNT(*)::int AS c FROM sessions WHERE date >= ${iso}`) as {
    c: number;
  }[];
  const thisWeek = weekRows[0].c;

  const dateRows = (await sql`SELECT DISTINCT date FROM sessions ORDER BY date DESC`) as {
    date: string;
  }[];
  const dates = dateRows.map((r) => r.date);

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const set = new Set(dates);
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
    lastDate: lastRows[0]?.date ?? null,
  };
}

/** Última alavanca registrada para FL e Planche. */
export async function getCurrentLevers(): Promise<{
  front: string | null;
  planche: string | null;
}> {
  await ensureSchema();
  const frontRows = (await sql`
    SELECT e.lever FROM entries e JOIN sessions s ON s.id = e.session_id
     WHERE e.is_skill = 1 AND e.lever IS NOT NULL
       AND (lower(e.exercise) LIKE '%front%' OR e.exercise LIKE '%FL%' OR e.lever LIKE '%FL%')
     ORDER BY s.date DESC, s.id DESC LIMIT 1`) as { lever: string }[];
  const plancheRows = (await sql`
    SELECT e.lever FROM entries e JOIN sessions s ON s.id = e.session_id
     WHERE e.is_skill = 1 AND e.lever IS NOT NULL
       AND (lower(e.exercise) LIKE '%planche%' OR e.lever LIKE '%lanche%')
     ORDER BY s.date DESC, s.id DESC LIMIT 1`) as { lever: string }[];
  return {
    front: frontRows[0]?.lever ?? null,
    planche: plancheRows[0]?.lever ?? null,
  };
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

/** Melhor (maior) max-hold por skill. */
export async function getBestHolds(): Promise<{
  front: number | null;
  planche: number | null;
}> {
  await ensureSchema();
  const f = (await sql`
    SELECT MAX(e.max_hold_s) AS m FROM entries e
     WHERE e.is_skill = 1 AND (lower(e.exercise) LIKE '%front%' OR e.exercise LIKE '%FL%' OR e.lever LIKE '%FL%')`) as {
    m: number | null;
  }[];
  const p = (await sql`
    SELECT MAX(e.max_hold_s) AS m FROM entries e
     WHERE e.is_skill = 1 AND (lower(e.exercise) LIKE '%planche%' OR e.lever LIKE '%lanche%')`) as {
    m: number | null;
  }[];
  return { front: f[0]?.m ?? null, planche: p[0]?.m ?? null };
}
