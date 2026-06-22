# Tarefas: Verificação do Supabase e Deploy no Vercel

> **Implementação:** 001 - Verificação do Supabase e Deploy no Vercel
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 1/7 tarefas concluídas (14%)
> **Última atualização:** 2026-06-22

---

## Legenda
- `[ ]` Pendente · `[x]` Concluída · `[!]` Bloqueada · `[-]` Cancelada

---

## Tarefas

### Fase 1: Validação local

- [x] **T-001:** Smoke test da API do Supabase ✅
  - **Descrição:** Script supabase-js que roda `insertWorkout` (sessão + entradas), as queries de leitura (resumo, skill progress, stats, best holds) e delete em cascata, contra o Supabase real.
  - **Arquivos envolvidos:** `_sbapitest.mjs` (temporário, removido)
  - **Critério de conclusão:** Todas as etapas passam; dados de teste removidos.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena
  - **Concluída em:** 2026-06-22 — settings upsert, insert em lote, resumo/skill/count, delete cascade: todos OK contra o Supabase do projeto.

- [ ] **T-002:** Validar app real local apontando para o Supabase
  - **Descrição:** Rodar `npm run dev` com `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` e exercitar home, registrar treino e histórico.
  - **Arquivos envolvidos:** `.env.local`
  - **Critério de conclusão:** Fluxo completo funciona sem erro no log.
  - **Dependências:** T-001
  - **Estimativa:** Pequena

### Fase 2: Segurança

- [ ] **T-003:** Habilitar RLS no schema
  - **Descrição:** Adicionar `alter table ... enable row level security` para `sessions`, `entries`, `settings` em `schema.sql` e aplicar no Supabase. service_role continua acessando.
  - **Arquivos envolvidos:** `supabase/schema.sql`
  - **Critério de conclusão:** RLS ligado; app continua funcionando via service_role.
  - **Dependências:** T-002
  - **Estimativa:** Pequena

- [ ] **T-004:** Rotacionar a chave service_role
  - **Descrição:** Resetar a service_role no Supabase (exposta no chat) e atualizar local/Vercel.
  - **Arquivos envolvidos:** `.env.local`
  - **Critério de conclusão:** Nova chave em uso; antiga inválida.
  - **Dependências:** T-003
  - **Estimativa:** Pequena

### Fase 3: Deploy

- [ ] **T-005:** Configurar variáveis no Vercel
  - **Descrição:** Adicionar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_PASSWORD`, `AUTH_SECRET` (e `OPENAI_*` opcional) nas Environment Variables.
  - **Arquivos envolvidos:** painel Vercel
  - **Critério de conclusão:** Variáveis salvas em Production.
  - **Dependências:** T-004
  - **Estimativa:** Pequena

- [ ] **T-006:** Push e redeploy
  - **Descrição:** `git push` da versão supabase-js e disparar redeploy.
  - **Arquivos envolvidos:** repositório
  - **Critério de conclusão:** Build verde no Vercel.
  - **Dependências:** T-005
  - **Estimativa:** Pequena

- [ ] **T-007:** Validação na URL pública
  - **Descrição:** Login → registrar treino → conferir histórico/coach na URL do Vercel.
  - **Arquivos envolvidos:** —
  - **Critério de conclusão:** Sem 500; treino persistido e visível.
  - **Dependências:** T-006
  - **Estimativa:** Pequena

---

## Registro de Progresso

| Tarefa | Status | Data | Observações |
|--------|--------|------|-------------|
| T-001 | ✅ Concluída | 2026-06-22 | API Supabase validada (escrita + leitura + cascade) |
| T-002 | ⬜ Pendente | — | — |
| T-003 | ⬜ Pendente | — | — |
| T-004 | ⬜ Pendente | — | — |
| T-005 | ⬜ Pendente | — | — |
| T-006 | ⬜ Pendente | — | — |
| T-007 | ⬜ Pendente | — | — |
