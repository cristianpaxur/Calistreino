-- 002 — Multi-tenant: adiciona user_id, defaults e políticas RLS por usuário.
-- Rode no Supabase → SQL Editor. RLS já foi habilitado em schema.sql.
-- IMPORTANTE: rode o BACKFILL (002_backfill_pilot.sql) ANTES de criar a PK
-- composta de settings e de tornar user_id NOT NULL, senão as linhas antigas
-- (com user_id nulo) violam as constraints.

-- 1) Coluna user_id (nullable por enquanto; o backfill preenche)
alter table sessions add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table entries  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table settings add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 2) Default = usuário logado (inserts preenchem sozinhos)
alter table sessions alter column user_id set default auth.uid();
alter table entries  alter column user_id set default auth.uid();
alter table settings alter column user_id set default auth.uid();

-- 3) Índices por usuário
create index if not exists idx_sessions_user on sessions(user_id);
create index if not exists idx_entries_user  on entries(user_id);

-- 4) Políticas RLS — cada usuário só acessa o que é seu
drop policy if exists "own sessions" on sessions;
create policy "own sessions" on sessions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own entries" on entries;
create policy "own entries" on entries for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own settings" on settings;
create policy "own settings" on settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- → Em seguida: crie a conta-piloto (signup) e rode 002_backfill_pilot.sql com o uuid dela.
