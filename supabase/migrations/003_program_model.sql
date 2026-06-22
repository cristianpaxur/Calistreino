-- 003 — Modelo de Dados Unificado: Programa → Dia → Exercício + Biblioteca + Escadas.
-- Rode no Supabase → SQL Editor DEPOIS da 002 (precisa de auth.users + auth.uid()).
-- A API (PostgREST) não roda DDL → este SQL é versionado aqui e aplicado à mão (portão humano).
--
-- Decisões de design (R7/R8):
--  • PKs novas em uuid (gen_random_uuid()); as FKs adicionadas em `entries` (serial) são
--    NULLABLE + on delete set null → histórico legado tolerante a null, nunca alteramos colunas existentes.
--  • `day_exercises` aceita exercise_id (biblioteca) OU exercise_name livre (não trava o usuário).
--  • exercise_library/skills/skill_levels: linhas GLOBAIS (owner_user_id null) lidas por todos;
--    linhas CUSTOM (owner_user_id = auth.uid()) só pelo dono.
--  • programs/program_days/day_exercises: RLS por user_id (default auth.uid()).

-- ── Extensão para uuid ───────────────────────────────────────────────
create extension if not exists pgcrypto;

-- ── Biblioteca de exercícios ─────────────────────────────────────────
create table if not exists exercise_library (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null,
  name          text not null,
  category      text,                       -- skill | forca | core | pernas
  pattern       text,                       -- front | planche | push | pull | legs | core ...
  is_skill      boolean not null default false,
  default_unit  text not null default 'reps',  -- reps | seconds
  equipment     text[] not null default '{}',
  cues          text,
  demo_url      text,
  owner_user_id uuid references auth.users(id) on delete cascade,  -- null = global
  created_at    timestamptz not null default now()
);
-- slug único por escopo (global x por-usuário). Dois índices parciais porque
-- NULL não conflita em unique normal.
create unique index if not exists uq_exlib_slug_global
  on exercise_library(slug) where owner_user_id is null;
create unique index if not exists uq_exlib_slug_owner
  on exercise_library(owner_user_id, slug) where owner_user_id is not null;

-- ── Skills + escadas (ladders) ───────────────────────────────────────
create table if not exists skills (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null,
  name          text not null,
  owner_user_id uuid references auth.users(id) on delete cascade,  -- null = global
  created_at    timestamptz not null default now()
);
create unique index if not exists uq_skills_slug_global
  on skills(slug) where owner_user_id is null;
create unique index if not exists uq_skills_slug_owner
  on skills(owner_user_id, slug) where owner_user_id is not null;

create table if not exists skill_levels (
  id        uuid primary key default gen_random_uuid(),
  skill_id  uuid not null references skills(id) on delete cascade,
  position  integer not null,            -- ordem na escada (0 = mais fácil)
  name      text not null,               -- ex.: "Tuck", "Advanced tuck", "Full"
  created_at timestamptz not null default now()
);
create unique index if not exists uq_skill_levels_pos on skill_levels(skill_id, position);
create index if not exists idx_skill_levels_skill on skill_levels(skill_id);

-- ── Programa → Dia → Exercício ───────────────────────────────────────
create table if not exists programs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  archetype   text,                       -- ex.: "fl-planche", "iniciante" ...
  source      text not null default 'manual',  -- seed | ai | manual
  cycle_weeks integer,
  active      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_programs_user on programs(user_id);
-- No máximo 1 programa ativo por usuário.
create unique index if not exists uq_programs_one_active
  on programs(user_id) where active;

create table if not exists program_days (
  id         uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code       text not null,               -- D1..D5
  weekday    text,                        -- Seg, Ter...
  title      text not null,
  focus      text,
  character  text,                        -- intensidade / volume / recuperação
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_program_days_program on program_days(program_id);
create index if not exists idx_program_days_user on program_days(user_id);

create table if not exists day_exercises (
  id             uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references program_days(id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exercise_id    uuid references exercise_library(id) on delete set null,  -- nullable: nome livre
  exercise_name  text,                    -- usado quando exercise_id é null
  is_skill       boolean not null default false,
  prescription   text,                    -- texto prescrito (séries × tempo/reps)
  target_unit    text default 'reps',     -- reps | seconds
  target_min     integer,
  target_max     integer,
  rest_seconds   integer,
  position       integer not null default 0,
  note           text,
  created_at     timestamptz not null default now(),
  constraint day_exercises_has_name check (exercise_id is not null or exercise_name is not null)
);
create index if not exists idx_day_exercises_day on day_exercises(program_day_id);
create index if not exists idx_day_exercises_user on day_exercises(user_id);

-- ── Vincular entries (log existente) ao programa ─────────────────────
-- FKs NULLABLE + on delete set null (R8): histórico antigo continua válido.
alter table entries add column if not exists program_day_id uuid
  references program_days(id) on delete set null;
alter table entries add column if not exists day_exercise_id uuid
  references day_exercises(id) on delete set null;

-- ── RLS ──────────────────────────────────────────────────────────────
alter table exercise_library enable row level security;
alter table skills           enable row level security;
alter table skill_levels     enable row level security;
alter table programs         enable row level security;
alter table program_days     enable row level security;
alter table day_exercises    enable row level security;

-- Biblioteca: lê global (owner null) OU o próprio; escreve só o próprio.
drop policy if exists "read library" on exercise_library;
create policy "read library" on exercise_library for select
  using (owner_user_id is null or owner_user_id = auth.uid());
drop policy if exists "write own library" on exercise_library;
create policy "write own library" on exercise_library for all
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

drop policy if exists "read skills" on skills;
create policy "read skills" on skills for select
  using (owner_user_id is null or owner_user_id = auth.uid());
drop policy if exists "write own skills" on skills;
create policy "write own skills" on skills for all
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

-- skill_levels: visível/escrevível conforme a skill-pai.
drop policy if exists "read skill_levels" on skill_levels;
create policy "read skill_levels" on skill_levels for select
  using (exists (
    select 1 from skills s where s.id = skill_levels.skill_id
      and (s.owner_user_id is null or s.owner_user_id = auth.uid())
  ));
drop policy if exists "write own skill_levels" on skill_levels;
create policy "write own skill_levels" on skill_levels for all
  using (exists (
    select 1 from skills s where s.id = skill_levels.skill_id and s.owner_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from skills s where s.id = skill_levels.skill_id and s.owner_user_id = auth.uid()
  ));

-- Programa e descendentes: cada usuário só acessa o que é seu.
drop policy if exists "own programs" on programs;
create policy "own programs" on programs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own program_days" on program_days;
create policy "own program_days" on program_days for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own day_exercises" on day_exercises;
create policy "own day_exercises" on day_exercises for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
