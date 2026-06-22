# Tarefas: Modelo de Dados Unificado (Programa, Dia, Exercício, Biblioteca)

> **Implementação:** 003 - Modelo de Dados Unificado (Programa/Dia/Exercício/Biblioteca)
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 7/9 tarefas concluídas (código); 2 com portão humano (78%)
> **Última atualização:** 2026-06-22

---

## Legenda
- `[ ]` Pendente · `[x]` Concluída · `[!]` Bloqueada · `[-]` Cancelada

---

## Tarefas

### Fase 1: Schema

- [x] **T-001:** Tabelas de biblioteca e escadas
  - **Descrição:** Criar `exercise_library`, `skills`, `skill_levels` com RLS (globais lê-todos; custom por usuário).
  - **Arquivos envolvidos:** `supabase/migrations/003_program_model.sql`, `supabase/schema.sql` (comentários)
  - **Critério de conclusão:** Tabelas + políticas escritas (SQL versionado; aplicação = portão humano).
  - **Dependências:** Nenhuma
  - **Estimativa:** Média

- [x] **T-002:** Tabelas de programa
  - **Descrição:** Criar `programs`, `program_days`, `day_exercises` com RLS por `user_id` + índice 1-ativo.
  - **Arquivos envolvidos:** `supabase/migrations/003_program_model.sql`
  - **Critério de conclusão:** Tabelas + políticas escritas.
  - **Dependências:** Nenhuma
  - **Estimativa:** Média

- [x] **T-003:** Vincular `entries` ao programa
  - **Descrição:** Adicionar `program_day_id`/`day_exercise_id` nullable em `entries` (`on delete set null`, R8).
  - **Arquivos envolvidos:** `supabase/migrations/003_program_model.sql`
  - **Critério de conclusão:** Colunas adicionadas via `add column if not exists` sem alterar colunas legadas.
  - **Dependências:** T-002
  - **Estimativa:** Pequena

### Fase 2: Tipos e acesso

- [x] **T-004:** Tipos do domínio de plano
  - **Descrição:** Criar `program-types.ts` (Program, ProgramDay, DayExercise, LibraryExercise, Skill, SkillLevel + shapes de insert/draft/view).
  - **Arquivos envolvidos:** `src/lib/program-types.ts`
  - **Critério de conclusão:** Tipos cobrindo o schema. ✓ compila no `next build`.
  - **Dependências:** T-001, T-002
  - **Estimativa:** Pequena

- [x] **T-005:** CRUD de programa/biblioteca
  - **Descrição:** `getActiveProgram`, `getActiveProgramView`, `getProgramDay`, `listLibrary`, `listSkills`, `createProgram`, `createProgramDay`, `upsertDayExercise`, `setActiveProgram`, `insertProgramDraft`. Tudo via `await db()` (RLS, nunca service_role no runtime — R2).
  - **Arquivos envolvidos:** `src/lib/programs.ts`
  - **Critério de conclusão:** Ler/escrever programa e biblioteca via supabase-js. ✓ compila.
  - **Dependências:** T-004
  - **Estimativa:** Grande

### Fase 3: Migração

- [x] **T-006:** Seed a partir do `PLAN`
  - **Descrição:** `planToProgramDraft()` (puro) converte `PLAN` em `ProgramDraft` (programa+dias+exercícios); `planToSkillLadders()` deriva as escadas FL/Planche.
  - **Arquivos envolvidos:** `src/lib/seed-plan.ts`, `src/lib/plan.ts`
  - **Critério de conclusão:** Função pura gera linhas equivalentes ao plano atual. ✓ confirmado por `verify-seed`.
  - **Dependências:** T-005
  - **Estimativa:** Média

- [!] **T-007:** Atribuir programa ativo ao usuário-piloto — **PORTÃO HUMANO**
  - **Descrição:** Script `scripts/seed-program.ts` insere o programa-modelo + escadas e marca `active` para o piloto. Código pronto; execução requer Supabase real + `PILOT_USER_ID` + `SUPABASE_SERVICE_ROLE_KEY`.
  - **Arquivos envolvidos:** `scripts/seed-program.ts`, `package.json` (`npm run seed:program`)
  - **Critério de conclusão (código):** Script escrito e idempotente. **Pendente humano:** aplicar `003_program_model.sql` e rodar `seed:program`.
  - **Dependências:** T-006
  - **Estimativa:** Pequena

### Fase 4: Validação

- [x] **T-008:** Teste seed × PLAN
  - **Descrição:** Script offline `scripts/verify-seed.ts` compara o draft gerado com o `PLAN` (dias, exercícios, prescrições, unidade, notas, posição).
  - **Arquivos envolvidos:** `scripts/verify-seed.ts`, `package.json` (`npm run verify:seed`)
  - **Critério de conclusão:** Equivalência confirmada offline (sem rede). ✓ passa.
  - **Dependências:** T-006
  - **Estimativa:** Pequena

- [x] **T-009:** Documentar o modelo
  - **Descrição:** Comentários do modelo (diagrama ASCII das relações) em `supabase/schema.sql`; cabeçalho de design na migração 003.
  - **Arquivos envolvidos:** `supabase/schema.sql`, `supabase/migrations/003_program_model.sql`
  - **Critério de conclusão:** Modelo documentado. (README não tocado — fora do escopo de código desta fatia.)
  - **Dependências:** T-002
  - **Estimativa:** Pequena

---

## Registro de Progresso

| Tarefa | Status | Data | Observações |
|--------|--------|------|-------------|
| T-001 | ✅ Código | 2026-06-22 | `003_program_model.sql` (library/skills/skill_levels + RLS). Aplicação = humano. |
| T-002 | ✅ Código | 2026-06-22 | programs/program_days/day_exercises + RLS + índice 1-ativo. |
| T-003 | ✅ Código | 2026-06-22 | `entries.program_day_id`/`day_exercise_id` nullable, on delete set null. |
| T-004 | ✅ Código | 2026-06-22 | `src/lib/program-types.ts`. |
| T-005 | ✅ Código | 2026-06-22 | `src/lib/programs.ts` (CRUD via `await db()`, RLS). |
| T-006 | ✅ Código | 2026-06-22 | `src/lib/seed-plan.ts` (`planToProgramDraft` puro). |
| T-007 | 🟠 Portão humano | 2026-06-22 | `scripts/seed-program.ts` pronto; rodar contra Supabase real. |
| T-008 | ✅ Código | 2026-06-22 | `scripts/verify-seed.ts` passa offline. |
| T-009 | ✅ Código | 2026-06-22 | Comentários/diagrama em `schema.sql` + migração. |
