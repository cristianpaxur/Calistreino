import "server-only";
import postgres from "postgres";

// Banco Postgres (funciona com qualquer provedor: Vercel Postgres, Neon,
// Supabase, etc.). Lê a string de conexão da primeira variável disponível.
// Prefira as URLs "pooled" (pgbouncer) em serverless.
const ENV_NAMES = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
];

function connectionString(): string {
  for (const n of ENV_NAMES) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  throw new Error(
    "Banco não configurado: defina DATABASE_URL (ou POSTGRES_URL) no ambiente com a string de conexão do Postgres."
  );
}

type Sql = ReturnType<typeof postgres>;

// Conexão lazy + singleton entre invocações (Proxy): importar o módulo nunca
// conecta nem lança — só o primeiro uso real exige a env (não quebra o build).
const globalForDb = globalThis as unknown as { __pg?: Sql };
let real: Sql | null = globalForDb.__pg ?? null;

function client(): Sql {
  if (!real) {
    const cs = connectionString();
    const isLocal = /localhost|127\.0\.0\.1/.test(cs);
    real = postgres(cs, {
      ssl: isLocal ? false : "require",
      prepare: false, // compatível com poolers em modo transaction (pgbouncer)
      max: 1,
      idle_timeout: 20,
    });
    globalForDb.__pg = real;
  }
  return real;
}

export const sql = new Proxy(function () {} as unknown as Sql, {
  apply(_t, _this, args: unknown[]) {
    return (client() as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_t, prop: string) {
    const r = client() as unknown as Record<string, unknown>;
    const v = r[prop];
    return typeof v === "function" ? v.bind(r) : v;
  },
}) as Sql;

// ---------- Schema (idempotente, memoizado por instância) ----------
let schemaReady: Promise<void> | null = null;
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS sessions (
        id          SERIAL PRIMARY KEY,
        date        TEXT NOT NULL,
        day_code    TEXT NOT NULL,
        week        INTEGER,
        block       TEXT,
        elbow_pain  INTEGER,
        lower_back  INTEGER,
        notes       TEXT,
        created_at  TEXT NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS entries (
        id            SERIAL PRIMARY KEY,
        session_id    INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        exercise      TEXT NOT NULL,
        category      TEXT,
        is_skill      INTEGER DEFAULT 0,
        lever         TEXT,
        max_hold_s    REAL,
        sets          INTEGER,
        reps_or_time  TEXT,
        rir           TEXT,
        done          INTEGER DEFAULT 1,
        notes         TEXT,
        position      INTEGER DEFAULT 0
      )`;
      await sql`CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT
      )`;
      await sql`CREATE INDEX IF NOT EXISTS idx_entries_session ON entries(session_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date)`;
    })().catch((e) => {
      schemaReady = null; // permite nova tentativa no próximo cold start
      throw e;
    });
  }
  return schemaReady;
}

// ---------- Settings ----------
export async function getSetting(key: string): Promise<string | null> {
  await ensureSchema();
  const rows = (await sql`SELECT value FROM settings WHERE key = ${key}`) as unknown as {
    value: string;
  }[];
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await ensureSchema();
  await sql`INSERT INTO settings (key, value) VALUES (${key}, ${value})
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
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
  await ensureSchema();
  const inserted = (await sql`
    INSERT INTO sessions (date, day_code, week, block, elbow_pain, lower_back, notes, created_at)
    VALUES (${s.date}, ${s.day_code}, ${s.week}, ${s.block}, ${s.elbow_pain}, ${s.lower_back}, ${s.notes}, ${s.created_at})
    RETURNING id`) as unknown as { id: number }[];
  const id = inserted[0].id;

  const valid = entries.filter((e) => e.exercise && e.exercise.trim());
  if (valid.length) {
    const COLS = 12;
    const placeholders = valid
      .map(
        (_, r) =>
          `(${Array.from({ length: COLS }, (_, c) => `$${r * COLS + c + 1}`).join(",")})`
      )
      .join(",");
    const params: (string | number | null)[] = [];
    for (const e of valid) {
      params.push(
        id,
        e.exercise.trim(),
        e.category,
        e.is_skill,
        e.lever,
        e.max_hold_s,
        e.sets,
        e.reps_or_time,
        e.rir,
        e.done,
        e.notes,
        e.position
      );
    }
    try {
      await sql.unsafe(
        `INSERT INTO entries (session_id, exercise, category, is_skill, lever, max_hold_s, sets, reps_or_time, rir, done, notes, position)
         VALUES ${placeholders}`,
        params
      );
    } catch (err) {
      await sql`DELETE FROM sessions WHERE id = ${id}`;
      throw err;
    }
  }
  return id;
}

export async function removeSession(id: number): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM sessions WHERE id = ${id}`;
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
