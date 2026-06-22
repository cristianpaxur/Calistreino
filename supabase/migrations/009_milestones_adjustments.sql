-- 009 — Acompanhamento Adaptativo: tabelas `milestones` e `plan_adjustments`.
-- Rode no Supabase → SQL Editor DEPOIS da 003 (precisa de `programs`). A API não
-- roda DDL → SQL versionado aqui, aplicação = portão humano.
--
-- O loop adaptativo (009) precisa de dois artefatos persistidos:
--   • milestones      — metas/checkpoints por programa/objetivo, com semana-alvo e
--                       status atualizado pelos dados (RF-001). 1 milestone aponta
--                       para um skill (slug) OU é uma meta livre (skill_slug null).
--   • plan_adjustments — trilha auditável (RNF-002) de cada ajuste proposto/aplicado
--                       (avançar/segurar/deload/volume) com o detalhe em jsonb.
--
-- Padrões herdados: user_id default auth.uid() → inserts preenchem sozinhos; RLS
-- por user_id (R2: runtime usa anon key + sessão, NUNCA service_role no cliente).
-- FK program_id on delete cascade (o ajuste/meta morre com o programa).

-- ── Milestones ────────────────────────────────────────────────────────
create table if not exists milestones (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid()
                 references auth.users(id) on delete cascade,
  program_id   uuid not null references programs(id) on delete cascade,
  skill_slug   text,                 -- slug da skill alvo; null => meta livre
  description  text not null,
  target_unit  text not null default 'seconds',  -- seconds | reps | lever
  target_value real,                 -- alvo numérico (seg/rep); null p/ alvo de alavanca
  target_lever text,                 -- nome da alavanca-alvo (quando target_unit=lever)
  due_week     integer,              -- semana-alvo dentro do ciclo
  status       text not null default 'pending',  -- pending | in_progress | achieved
  achieved_at  timestamptz,
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table milestones enable row level security;
drop policy if exists "own milestones" on milestones;
create policy "own milestones" on milestones for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_milestones_program on milestones(program_id);

-- ── Plan adjustments (auditoria) ─────────────────────────────────────
create table if not exists plan_adjustments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
                references auth.users(id) on delete cascade,
  program_id  uuid not null references programs(id) on delete cascade,
  week        integer,
  kind        text not null,         -- advance | hold | deload | volume
  skill_slug  text,                  -- skill afetada (quando aplicável)
  detail      jsonb not null default '{}'::jsonb,  -- { reasons, from, to, ... }
  applied     boolean not null default false,
  applied_at  timestamptz,
  created_at  timestamptz not null default now()
);

alter table plan_adjustments enable row level security;
drop policy if exists "own plan_adjustments" on plan_adjustments;
create policy "own plan_adjustments" on plan_adjustments for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_plan_adjustments_program on plan_adjustments(program_id);
