-- Schema do CalisTreino (rode uma vez no Supabase → SQL Editor).
-- Já foi aplicado neste projeto; mantido aqui para reprodutibilidade.
-- A API (PostgREST) não cria tabelas, então o schema é gerenciado por aqui.

create table if not exists sessions (
  id          serial primary key,
  date        text not null,
  day_code    text not null,
  week        integer,
  block       text,
  elbow_pain  integer,
  lower_back  integer,
  notes       text,
  created_at  text not null
);

create table if not exists entries (
  id            serial primary key,
  session_id    integer not null references sessions(id) on delete cascade,
  exercise      text not null,
  category      text,
  is_skill      integer default 0,
  lever         text,
  max_hold_s    real,
  sets          integer,
  reps_or_time  text,
  rir           text,
  done          integer default 1,
  notes         text,
  position      integer default 0
);

create table if not exists settings (
  key   text primary key,
  value text
);

create index if not exists idx_entries_session on entries(session_id);
create index if not exists idx_sessions_date on sessions(date);

-- ── Segurança (RNF-002) ───────────────────────────────────────────────
-- Habilita RLS SEM políticas: o acesso anônimo/anon fica bloqueado e o app,
-- que acessa só pelo servidor com a chave service_role, continua funcionando
-- (service_role ignora RLS). Defesa em profundidade até a 002 (políticas por
-- user_id com auth.uid()). NUNCA use a service_role no front-end.
alter table sessions enable row level security;
alter table entries  enable row level security;
alter table settings enable row level security;

-- ── Modelo de dados unificado (003) ──────────────────────────────────
-- A partir da migração 002 o runtime usa anon key + sessão (RLS por auth.uid()),
-- NUNCA service_role no front-end (R2). As tabelas multi-tenant (user_id, RLS)
-- ficam em supabase/migrations/002_multitenant.sql.
--
-- A 003 (supabase/migrations/003_program_model.sql) transforma o plano hardcoded
-- (src/lib/plan.ts) em DADO, com o modelo:
--
--   exercise_library ──┐
--   skills ─ skill_levels (escada: tuck → … → full)
--   programs ─ program_days ─ day_exercises ─(opcional)→ exercise_library
--   entries.program_day_id / entries.day_exercise_id  (FKs nullable, on delete set null)
--
-- Biblioteca/skills: linhas globais (owner_user_id null) lidas por todos; custom por usuário.
-- programs/program_days/day_exercises: RLS por user_id. Apenas 1 programa active por usuário.
-- A constante PLAN vira um SEED (src/lib/seed-plan.ts → planToProgramRows) aplicado por
-- scripts/seed-program.ts (portão humano: precisa de PILOT_USER_ID + chaves Supabase).

-- ── Onboarding & Anamnese (007) ──────────────────────────────────────
-- supabase/migrations/007_profiles.sql cria a tabela `profiles` (1 por usuário,
-- PK = user_id, RLS por auth.uid()). A anamnese estruturada grava ali o perfil
-- (archetype/goal_skill, perfil, benchmarks jsonb, health_flags jsonb da triagem
-- PAR-Q, logística, preferences) — contrato consumido pela geração de plano (008).
-- A lógica pura (perguntas, ramificação, validação, PAR-Q) fica em src/lib/anamnese.ts.

-- ── Acompanhamento adaptativo & milestones (009) ─────────────────────
-- supabase/migrations/009_milestones_adjustments.sql cria `milestones` (metas por
-- programa/objetivo, status atualizado pelos dados) e `plan_adjustments` (trilha
-- auditável de cada ajuste avançar/segurar/deload/volume). Ambas RLS por user_id,
-- FK program_id on delete cascade. As regras (deriveMilestones/evaluateWeek/
-- computeMilestoneStatus/isGoalComplete/buildAdjustments) são PURAS (sem IO) e
-- ficam em src/lib/milestones.ts, src/lib/progression.ts e src/lib/coach.ts; o IO
-- (ler entries, persistir milestones/ajustes) fica em src/lib/progression-io.ts.
