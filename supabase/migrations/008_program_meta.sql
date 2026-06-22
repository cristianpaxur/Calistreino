-- 008 — Auditoria da geração de plano por IA.
-- Rode no Supabase → SQL Editor DEPOIS da 003. A API não roda DDL → SQL versionado
-- aqui, aplicação = portão humano.
--
-- A geração (008) registra a trilha de auditoria do plano gerado: qual template
-- foi configurado, qual modelo de IA, o hash do perfil de entrada (cache/rastreio
-- — RNF-002), a origem (ai | fallback) e as issues que o validador ajustou.
-- Coluna única `meta jsonb` (nullable) para não alterar o shape existente (R8);
-- programas seed/manual ficam com meta null.

alter table programs add column if not exists meta jsonb;

comment on column programs.meta is
  'Auditoria 008: { templateId, model, inputProfileHash, origin, attempts, issues }. Null para seed/manual.';
