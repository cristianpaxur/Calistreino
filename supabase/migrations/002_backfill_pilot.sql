-- 002 — Backfill: atribui os dados existentes (single-tenant) à conta-piloto
-- e finaliza as constraints. Rode DEPOIS de 002_multitenant.sql e de criar a
-- conta-piloto (signup no app). Substitua :PILOT_USER_ID pelo uuid da conta
-- (Supabase → Authentication → Users → copie o ID).
--
-- ⚠️ Faça um BACKUP do banco antes (Database → Backups).

-- 1) Atribuir linhas órfãs ao piloto
update sessions set user_id = ':PILOT_USER_ID' where user_id is null;
update entries  set user_id = ':PILOT_USER_ID' where user_id is null;
update settings set user_id = ':PILOT_USER_ID' where user_id is null;

-- 2) Tornar user_id obrigatório
alter table sessions alter column user_id set not null;
alter table entries  alter column user_id set not null;
alter table settings alter column user_id set not null;

-- 3) settings: PK passa de (key) para (user_id, key)
alter table settings drop constraint if exists settings_pkey;
alter table settings add primary key (user_id, key);
