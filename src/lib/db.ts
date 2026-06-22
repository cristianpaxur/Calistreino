import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

// Banco de dados local em ./data/calistreino.db
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "calistreino.db");

// Singleton entre hot-reloads do Next em dev
const globalForDb = globalThis as unknown as { __db?: Database.Database };

function init(): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      date          TEXT NOT NULL,
      day_code      TEXT NOT NULL,
      week          INTEGER,
      block         TEXT,
      elbow_pain    INTEGER,
      lower_back    INTEGER,
      notes         TEXT,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
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
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_entries_session ON entries(session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
  `);

  return db;
}

export const db: Database.Database = globalForDb.__db ?? init();
if (process.env.NODE_ENV !== "production") globalForDb.__db = db;

// ---------- Settings ----------
export function getSetting(key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
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
