import { db, EntryRow, SessionRow } from "./db";

export function getSessions(limit?: number): SessionRow[] {
  const sql = `SELECT * FROM sessions ORDER BY date DESC, id DESC ${
    limit ? "LIMIT " + Number(limit) : ""
  }`;
  return db.prepare(sql).all() as SessionRow[];
}

export function getSession(id: number): SessionRow | undefined {
  return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as
    | SessionRow
    | undefined;
}

export function getEntries(sessionId: number): EntryRow[] {
  return db
    .prepare("SELECT * FROM entries WHERE session_id = ? ORDER BY position, id")
    .all(sessionId) as EntryRow[];
}

export interface SessionWithCount extends SessionRow {
  entry_count: number;
  skill_summary: string | null;
}

export function getSessionsWithSummary(limit?: number): SessionWithCount[] {
  const sql = `
    SELECT s.*,
      (SELECT COUNT(*) FROM entries e WHERE e.session_id = s.id) AS entry_count,
      (SELECT group_concat(e.lever || ' ' || COALESCE(e.max_hold_s,'') || 's', ' · ')
         FROM entries e WHERE e.session_id = s.id AND e.is_skill = 1 AND e.lever IS NOT NULL) AS skill_summary
    FROM sessions s
    ORDER BY s.date DESC, s.id DESC
    ${limit ? "LIMIT " + Number(limit) : ""}
  `;
  return db.prepare(sql).all() as SessionWithCount[];
}

export interface SkillPoint {
  date: string;
  max_hold_s: number;
  lever: string | null;
  exercise: string;
  session_id: number;
}

/** Histórico de max-hold por padrão de skill (FL ou Planche) para gráficos. */
export function getSkillProgress(pattern: "front" | "planche"): SkillPoint[] {
  const like =
    pattern === "front"
      ? "%front%"
      : "%planche%";
  // Casa pelo nome do exercício OU pela alavanca digitada (ex.: "FL straddle").
  const fallback = pattern === "front" ? "%FL%" : "%planche%";
  return db
    .prepare(
      `SELECT s.date AS date, e.max_hold_s AS max_hold_s, e.lever AS lever,
              e.exercise AS exercise, s.id AS session_id
         FROM entries e JOIN sessions s ON s.id = e.session_id
        WHERE e.is_skill = 1 AND e.max_hold_s IS NOT NULL
          AND (lower(e.exercise) LIKE ? OR e.lever LIKE ? OR e.exercise LIKE ?)
        ORDER BY s.date ASC, s.id ASC`
    )
    .all(like, fallback, pattern === "front" ? "%FL%" : "%Planche%") as SkillPoint[];
}

export interface PainPoint {
  date: string;
  elbow_pain: number | null;
  lower_back: number | null;
  day_code: string;
}

export function getPainHistory(): PainPoint[] {
  return db
    .prepare(
      `SELECT date, elbow_pain, lower_back, day_code FROM sessions
        WHERE elbow_pain IS NOT NULL OR lower_back IS NOT NULL
        ORDER BY date ASC, id ASC`
    )
    .all() as PainPoint[];
}

export interface Stats {
  total: number;
  thisWeek: number;
  streakDays: number;
  bestStreak: number;
  lastDate: string | null;
}

export function getStats(): Stats {
  const total = (db.prepare("SELECT COUNT(*) c FROM sessions").get() as { c: number }).c;
  const last = db
    .prepare("SELECT date FROM sessions ORDER BY date DESC, id DESC LIMIT 1")
    .get() as { date: string } | undefined;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const iso = sevenDaysAgo.toISOString().slice(0, 10);
  const thisWeek = (
    db.prepare("SELECT COUNT(*) c FROM sessions WHERE date >= ?").get(iso) as {
      c: number;
    }
  ).c;

  // streak de dias distintos com treino, terminando hoje ou ontem
  const dates = (
    db.prepare("SELECT DISTINCT date FROM sessions ORDER BY date DESC").all() as {
      date: string;
    }[]
  ).map((r) => r.date);
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const set = new Set(dates);
  // permite começar contagem a partir de hoje ou ontem
  if (!set.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // melhor sequência (dias consecutivos distintos)
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
    lastDate: last?.date ?? null,
  };
}

/** Última alavanca registrada para FL e Planche (para sugerir no dashboard). */
export function getCurrentLevers(): { front: string | null; planche: string | null } {
  const front = db
    .prepare(
      `SELECT e.lever FROM entries e JOIN sessions s ON s.id = e.session_id
        WHERE e.is_skill = 1 AND e.lever IS NOT NULL
          AND (lower(e.exercise) LIKE '%front%' OR e.exercise LIKE '%FL%' OR e.lever LIKE '%FL%')
        ORDER BY s.date DESC, s.id DESC LIMIT 1`
    )
    .get() as { lever: string } | undefined;
  const planche = db
    .prepare(
      `SELECT e.lever FROM entries e JOIN sessions s ON s.id = e.session_id
        WHERE e.is_skill = 1 AND e.lever IS NOT NULL
          AND (lower(e.exercise) LIKE '%planche%' OR e.lever LIKE '%lanche%')
        ORDER BY s.date DESC, s.id DESC LIMIT 1`
    )
    .get() as { lever: string } | undefined;
  return { front: front?.lever ?? null, planche: planche?.lever ?? null };
}

export interface CoachData {
  front: SkillPoint[];
  planche: SkillPoint[];
  pain: PainPoint[];
  recentSessions: SessionRow[];
}

export function getCoachData(): CoachData {
  return {
    front: getSkillProgress("front"),
    planche: getSkillProgress("planche"),
    pain: getPainHistory(),
    recentSessions: getSessions(8),
  };
}

/** Melhor (maior) max-hold por skill. */
export function getBestHolds(): { front: number | null; planche: number | null } {
  const f = db
    .prepare(
      `SELECT MAX(e.max_hold_s) m FROM entries e
        WHERE e.is_skill = 1 AND (lower(e.exercise) LIKE '%front%' OR e.exercise LIKE '%FL%' OR e.lever LIKE '%FL%')`
    )
    .get() as { m: number | null };
  const p = db
    .prepare(
      `SELECT MAX(e.max_hold_s) m FROM entries e
        WHERE e.is_skill = 1 AND (lower(e.exercise) LIKE '%planche%' OR e.lever LIKE '%lanche%')`
    )
    .get() as { m: number | null };
  return { front: f.m, planche: p.m };
}
