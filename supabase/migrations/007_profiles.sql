-- 007 — Onboarding & Anamnese: tabela `profiles` (1 por usuário).
-- Rode no Supabase → SQL Editor (PostgREST não roda DDL). Aplicação = portão humano.
--
-- O `profile` é o contrato que a anamnese (007) produz e a geração de plano (008)
-- consome: arquétipo + objetivo + perfil + benchmarks (jsonb) + triagem de saúde
-- (health_flags jsonb, PAR-Q) + logística + preferências.
--
-- PK = user_id (1 perfil por usuário). user_id default auth.uid() → inserts/upserts
-- preenchem sozinhos. RLS por user_id (R2: runtime usa anon key + sessão, nunca
-- service_role no cliente). FK on delete cascade segue o padrão de 002.

create table if not exists profiles (
  user_id          uuid primary key default auth.uid()
                     references auth.users(id) on delete cascade,
  -- objetivo / segmentação
  archetype        text,                 -- skill | strength | health
  goal_skill       text,                 -- slug da skill alvo (quando archetype=skill)
  -- perfil
  age              integer,
  sex              text,                 -- male | female | other | undisclosed
  bodyweight       real,                 -- kg
  height           real,                 -- cm
  training_age     text,                 -- none | lt1y | 1to3y | gt3y
  -- exame físico (benchmarks auto-reportados, por padrão de movimento)
  benchmarks       jsonb not null default '{}'::jsonb,
  -- triagem de saúde (PAR-Q): { flags: string[], level: ok|warn|block, answers: {...} }
  health_flags     jsonb not null default '{}'::jsonb,
  -- logística
  days_per_week    integer,
  session_minutes  integer,
  equipment        text[] not null default '{}',
  -- preferências livres (estilo, ênfases, restrições)
  preferences      jsonb not null default '{}'::jsonb,
  -- via escolhida no fork (guided => fez anamnese; freestyle => pulou)
  onboarding_path  text,                 -- guided | freestyle
  completed_at     timestamptz,
  updated_at       timestamptz not null default now()
);

-- RLS — cada usuário só acessa o próprio perfil.
alter table profiles enable row level security;

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
