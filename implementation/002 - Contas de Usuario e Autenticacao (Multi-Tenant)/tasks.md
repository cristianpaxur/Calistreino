# Tarefas: Contas de Usuário e Autenticação (Multi-Tenant)

> **Implementação:** 002 - Contas de Usuário e Autenticação (Multi-Tenant)
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 5/9 código concluído (build verde) · 4 aguardando portões humanos (aplicar migração, conta-piloto, backfill, teste de isolamento)
> **Última atualização:** 2026-06-22

> ⚠️ **Estado:** todo o CÓDIGO da 002 está escrito e `next build` passa. Para rodar ao vivo, faltam os portões humanos: aplicar `migrations/002_multitenant.sql`, criar a conta-piloto, rodar `002_backfill_pilot.sql` com o uuid, e trocar as envs para `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## Legenda
- `[ ]` Pendente · `[x]` Concluída · `[!]` Bloqueada · `[-]` Cancelada

---

## Tarefas

### Fase 1: Banco e RLS

- [ ] **T-001:** Adicionar `user_id` às tabelas
  - **Descrição:** `alter table` em `sessions`, `entries`, `settings` para incluir `user_id uuid` referenciando `auth.users`; `settings` com PK `(user_id, key)`.
  - **Arquivos envolvidos:** `supabase/schema.sql`
  - **Critério de conclusão:** Colunas e FKs criadas.
  - **Dependências:** Nenhuma
  - **Estimativa:** Média

- [ ] **T-002:** Políticas RLS por usuário
  - **Descrição:** Habilitar RLS e criar políticas `using (user_id = auth.uid())` para CRUD nas três tabelas.
  - **Arquivos envolvidos:** `supabase/schema.sql`
  - **Critério de conclusão:** Acesso anônimo negado; usuário só vê o seu.
  - **Dependências:** T-001
  - **Estimativa:** Média

### Fase 2: Autenticação

- [ ] **T-003:** Instalar e configurar Supabase Auth helpers (SSR)
  - **Descrição:** Adicionar `@supabase/ssr`; criar utilitários de cliente server/browser que leem a sessão dos cookies.
  - **Arquivos envolvidos:** `src/lib/supabase-server.ts`, `src/lib/supabase-browser.ts`
  - **Critério de conclusão:** Cliente por-request criado a partir dos cookies.
  - **Dependências:** Nenhuma
  - **Estimativa:** Média

- [ ] **T-004:** Telas de cadastro e login
  - **Descrição:** Substituir o login por senha única por e-mail/senha (signUp/signIn) mantendo a identidade visual.
  - **Arquivos envolvidos:** `src/app/login/page.tsx`, `src/app/auth-actions.ts`
  - **Critério de conclusão:** Cadastro e login funcionam.
  - **Dependências:** T-003
  - **Estimativa:** Média

- [ ] **T-005:** Middleware com sessão Supabase
  - **Descrição:** Proteger rotas via sessão Supabase; remover cookie HMAC/`APP_PASSWORD`.
  - **Arquivos envolvidos:** `src/middleware.ts`, `src/lib/auth.ts`
  - **Critério de conclusão:** Sem sessão → redireciona a login.
  - **Dependências:** T-003
  - **Estimativa:** Média

### Fase 3: Escopar dados

- [ ] **T-006:** Migrar `db.ts`/`queries.ts`/`actions.ts` para cliente com sessão
  - **Descrição:** Trocar o cliente service_role pelo cliente por-request (RLS aplica o filtro de usuário). `insert` preenche `user_id` automaticamente via default `auth.uid()`.
  - **Arquivos envolvidos:** `src/lib/db.ts`, `src/lib/queries.ts`, `src/app/actions.ts`
  - **Critério de conclusão:** Todas as queries operam no escopo do usuário logado.
  - **Dependências:** T-002, T-003
  - **Estimativa:** Grande

- [ ] **T-007:** Migração dos dados existentes
  - **Descrição:** Criar uma conta para o usuário-piloto e atribuir `user_id` às linhas existentes.
  - **Arquivos envolvidos:** script de migração (SQL)
  - **Critério de conclusão:** Histórico antigo aparece na conta correta.
  - **Dependências:** T-006
  - **Estimativa:** Pequena

### Fase 4: Validação

- [ ] **T-008:** Teste de isolamento com 2 contas
  - **Descrição:** Criar 2 contas, gravar treinos distintos, confirmar que nenhuma vê a outra.
  - **Arquivos envolvidos:** —
  - **Critério de conclusão:** Isolamento confirmado.
  - **Dependências:** T-006, T-007
  - **Estimativa:** Pequena

- [ ] **T-009:** Atualizar nav/ajustes (logout, conta)
  - **Descrição:** Botão de logout via Supabase; exibir e-mail/conta em Ajustes.
  - **Arquivos envolvidos:** `src/components/Nav.tsx`, `src/app/configuracoes/page.tsx`
  - **Critério de conclusão:** Logout e identificação da conta funcionam.
  - **Dependências:** T-005
  - **Estimativa:** Pequena

---

## Registro de Progresso

| Tarefa | Status | Data | Observações |
|--------|--------|------|-------------|
| T-001 | 🟦 Código pronto (SQL) | 2026-06-22 | `migrations/002_multitenant.sql` — aplicar no SQL Editor |
| T-002 | 🟦 Código pronto (SQL) | 2026-06-22 | políticas RLS no mesmo migration |
| T-003 | ✅ Concluída | 2026-06-22 | `supabase-server.ts`/`supabase-browser.ts` + `@supabase/ssr` |
| T-004 | ✅ Concluída | 2026-06-22 | `login/page.tsx` + `auth-actions.ts` (signIn/signUp) |
| T-005 | ✅ Concluída | 2026-06-22 | `middleware.ts` (sessão Supabase) |
| T-006 | ✅ Concluída | 2026-06-22 | `db.ts`/`queries.ts` async por-request; build verde |
| T-007 | 🟦 Código pronto (SQL) | 2026-06-22 | `002_backfill_pilot.sql` — precisa do uuid do piloto |
| T-008 | ⬜ Pendente (humano) | — | teste de isolamento com 2 contas ao vivo |
| T-009 | ✅ Concluída | 2026-06-22 | `Nav.tsx`/`configuracoes` (logout + e-mail da conta) |
