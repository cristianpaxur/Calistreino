-- 010 — Monetização Freemium: tabelas `subscriptions` e `stripe_events`.
-- Rode no Supabase → SQL Editor DEPOIS da 002 (precisa de auth.users + RLS por
-- auth.uid()). A API não roda DDL → SQL versionado aqui; aplicação = portão humano.
--
-- Modelo (spec §3.4):
--   • subscriptions  — 1 linha por usuário: tier (free|pro), status do Stripe e os
--                      IDs (customer/subscription) + fim do período atual. O RUNTIME
--                      só LÊ esta tabela (gate); QUEM ESCREVE é o webhook do Stripe,
--                      que roda com a service_role (sem sessão de usuário) — por isso
--                      há uma policy de leitura própria (RLS) e a escrita do webhook
--                      passa por cima do RLS via service_role.
--   • stripe_events  — idempotência do webhook (R10/RNF-002): cada event.id é gravado
--                      uma única vez; reprocessamento é no-op.
--
-- Padrões herdados (002): user_id default auth.uid(); RLS por user_id; o runtime
-- usa anon key + sessão (NUNCA service_role no cliente — R2).

-- ── Subscriptions ─────────────────────────────────────────────────────
create table if not exists subscriptions (
  user_id                 uuid primary key default auth.uid()
                            references auth.users(id) on delete cascade,
  tier                    text not null default 'free',   -- free | pro
  status                  text not null default 'none',   -- active | trialing | past_due | canceled | ...
  stripe_customer_id      text,
  stripe_subscription_id  text,
  current_period_end      timestamptz,
  updated_at              timestamptz not null default now(),
  created_at              timestamptz not null default now()
);

alter table subscriptions enable row level security;

-- O usuário só ENXERGA a própria assinatura (gate de leitura). A ESCRITA é feita
-- SEMPRE pela service_role (ignora RLS): tanto o webhook do Stripe quanto a
-- gravação do stripe_customer_id no início do checkout (`getOrCreateCustomerId`).
-- NÃO há policy de insert/update para usuários comuns de propósito — assim o
-- client jamais consegue forjar tier='pro'/status='active' na própria linha
-- (RNF-001: não burlável). O runtime só LÊ esta tabela.
drop policy if exists "read own subscription" on subscriptions;
create policy "read own subscription" on subscriptions for select
  using (user_id = auth.uid());

create index if not exists idx_subscriptions_customer
  on subscriptions(stripe_customer_id);

-- ── Stripe events (idempotência do webhook) ──────────────────────────
create table if not exists stripe_events (
  id            text primary key,          -- event.id do Stripe (único)
  type          text not null,
  processed_at  timestamptz not null default now()
);

-- Sem policy de usuário: tabela manipulada só pelo webhook (service_role). RLS
-- ligada para negar acesso anônimo/usuário por padrão.
alter table stripe_events enable row level security;
