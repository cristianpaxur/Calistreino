# Tarefas: Acompanhamento Adaptativo, Milestones e Loop de Objetivo

> **Implementação:** 009 - Acompanhamento Adaptativo, Milestones e Loop de Objetivo
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 8/8 tarefas de código concluídas (100%) — aplicação SQL + e2e ao vivo são portões humanos
> **Última atualização:** 2026-06-22

---

## Legenda
- `[ ]` Pendente · `[x]` Concluída · `[!]` Bloqueada · `[-]` Cancelada

---

## Tarefas

### Fase 1: Modelo

- [x] **T-001:** Tabelas `milestones` e `plan_adjustments`
  - **Descrição:** Criar tabelas com RLS por usuário.
  - **Arquivos envolvidos:** `supabase/migrations/009_milestones_adjustments.sql`, `supabase/schema.sql` (doc)
  - **Critério de conclusão:** Tabelas + políticas criadas.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena
  - **Nota:** SQL versionado. **Portão humano:** aplicar no SQL Editor (PostgREST não roda DDL).

- [x] **T-002:** Derivar milestones do plano
  - **Descrição:** Ao criar/gerar o programa, gerar milestones (por skill/objetivo, com semana-alvo).
  - **Arquivos envolvidos:** `src/lib/milestones.ts` (`deriveMilestones`, puro), `src/lib/progression-io.ts` (`ensureMilestonesForActiveProgram`, idempotente)
  - **Critério de conclusão:** Milestones criados junto com o plano.
  - **Dependências:** T-001
  - **Estimativa:** Média
  - **Nota:** `deriveMilestones` é puro (testado offline). A persistência é **lazy + idempotente** (ensure no 1º acesso ao coach); tolera a migração 009 ainda não aplicada (devolve derivados em memória).

### Fase 2: Avaliação e ajuste

- [x] **T-003:** Estender regras de ajuste no coach
  - **Descrição:** A partir das `entries` recentes, decidir avançar/segurar/deload/volume (reusar `coach.ts`).
  - **Arquivos envolvidos:** `src/lib/coach.ts` (`buildAdjustments`, puro), `src/lib/progression.ts` (`evaluateWeek`, puro)
  - **Critério de conclusão:** Propostas coerentes com as regras.
  - **Dependências:** Nenhuma
  - **Estimativa:** Grande
  - **Nota:** Reusa `buildReport` existente. Deload global precede ajustes por skill; advance aponta a próxima alavanca da escada. Conservador (R: nunca auto-aplica).

- [x] **T-004:** Atualizar status de milestones pelos dados
  - **Descrição:** Marcar milestone como atingido quando o benchmark é alcançado.
  - **Arquivos envolvidos:** `src/lib/milestones.ts` (`computeMilestoneStatus`/`updateMilestoneStatuses`/`isGoalComplete`, puros), `src/lib/progression-io.ts` (`persistMilestoneStatuses`)
  - **Critério de conclusão:** Status reflete o histórico.
  - **Dependências:** T-002, T-003
  - **Estimativa:** Média

- [x] **T-005:** Aplicar ajuste ao programa
  - **Descrição:** Ação que aplica a proposta (ex.: subir alavanca-alvo do skill) e registra em `plan_adjustments`.
  - **Arquivos envolvidos:** `src/app/actions.ts` (`applyPlanAdjustment`), `src/lib/progression-io.ts` (`applyAdjustment`/`recordAdjustment`)
  - **Critério de conclusão:** Programa muda; ajuste auditado.
  - **Dependências:** T-003
  - **Estimativa:** Média
  - **Nota:** `advance` atualiza a `note` (alavanca-alvo) dos `day_exercises` de skill; `deload`/`hold` são auditados mas não mudam o programa (só sugestão). Auditoria em `plan_adjustments` tolera tabela 009 ausente.

### Fase 3: UX e loop

- [x] **T-006:** Coach mostra milestones + ajuste sugerido
  - **Descrição:** Adicionar à tela do coach o progresso de milestones e o botão de aplicar ajuste.
  - **Arquivos envolvidos:** `src/app/coach/page.tsx`, `src/components/MilestonesPanel.tsx`, `src/components/AdjustmentsPanel.tsx`
  - **Critério de conclusão:** Sugestão visível e aplicável.
  - **Dependências:** T-004, T-005
  - **Estimativa:** Média
  - **Nota:** Barra de progresso de milestones; ajustes com botão APLICAR (só `advance` é aplicável e só com programa real — na semente PLAN só exibe). Identidade visual reusa `card`/`btn-lime`/tokens.

- [x] **T-007:** Loop de conclusão de objetivo
  - **Descrição:** Ao concluir milestones/objetivo, comemorar e oferecer próximo objetivo (encaminha a 007/008).
  - **Arquivos envolvidos:** `src/app/coach/page.tsx`, `src/components/GoalCompletePanel.tsx`, `src/app/actions.ts` (`completeGoalAndStartNext`)
  - **Critério de conclusão:** Loop de novo objetivo funciona.
  - **Dependências:** T-004
  - **Estimativa:** Média
  - **Nota:** `goalComplete` (via `isGoalComplete`) mostra o painel de comemoração → persiste status + redirect para `/onboarding` (rota 007 já existe).

### Fase 4: Validação

- [x] **T-008:** Testes de progressão
  - **Descrição:** Histórico simulado (avanço, regressão, dor) → ajuste correto; conclusão dispara loop.
  - **Arquivos envolvidos:** `scripts/verify-progression.ts`, `package.json` (`verify:progression`)
  - **Critério de conclusão:** Cenários validados.
  - **Dependências:** T-005, T-007
  - **Estimativa:** Pequena
  - **Nota:** 21 checagens offline (sem rede) — verde. Cobre derivação, status, advance/hold/deload e conclusão→loop.
  - **Portão humano:** runner de testes ao vivo (vitest) e e2e com dados reais ficam para §3-E/§3-G do roadmap.

---

## Registro de Progresso

| Tarefa | Status | Data | Observações |
|--------|--------|------|-------------|
| T-001 | ✅ Código | 2026-06-22 | Migração `009_milestones_adjustments.sql`. Aplicação SQL = portão humano. |
| T-002 | ✅ Código | 2026-06-22 | `deriveMilestones` (puro) + `ensureMilestonesForActiveProgram` (lazy/idempotente). |
| T-003 | ✅ Código | 2026-06-22 | `buildAdjustments` (coach) + `evaluateWeek` (progression), puros. |
| T-004 | ✅ Código | 2026-06-22 | `computeMilestoneStatus`/`updateMilestoneStatuses`/`isGoalComplete` + persistência. |
| T-005 | ✅ Código | 2026-06-22 | `applyPlanAdjustment` action + `applyAdjustment`/auditoria em `plan_adjustments`. |
| T-006 | ✅ Código | 2026-06-22 | `MilestonesPanel` + `AdjustmentsPanel` no `/coach`. |
| T-007 | ✅ Código | 2026-06-22 | `GoalCompletePanel` + `completeGoalAndStartNext` → `/onboarding`. |
| T-008 | ✅ Código | 2026-06-22 | `scripts/verify-progression.ts` — 21 checagens offline verdes. |

### Portões humanos (009)
- Aplicar `supabase/migrations/009_milestones_adjustments.sql` no SQL Editor (depois da 003).
- `003`+`004`+`008` aplicadas (programs/ladders/runtime) para o loop operar com dados reais.
- `OPENAI_API_KEY` opcional (a explicação por IA reusa o `CoachPanel` existente).
- Testes e2e com dados reais; runner de testes ao vivo (vitest) — §3-E/§3-G do roadmap.
