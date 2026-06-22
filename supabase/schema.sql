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

-- Observação: o app acessa só pelo servidor com a chave service_role (que ignora
-- RLS). Por isso não há políticas RLS aqui. Não use a chave service_role no front.
