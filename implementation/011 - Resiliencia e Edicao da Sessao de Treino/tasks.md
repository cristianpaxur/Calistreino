# Tarefas: Resiliência e Edição da Sessão de Treino

> **Implementação:** 011 - Resiliência e Edição da Sessão de Treino
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 7/9 tarefas concluídas (78%)
> **Última atualização:** 2026-06-23

---

## Legenda
- `[ ]` — Pendente · `[x]` — Concluída · `[!]` — Bloqueada · `[-]` — Cancelada

---

## Tarefas

### Fase 1: Preparação e Setup

- [x] **T-001:** Criar módulo de draft de sessão (puro)
  - **Descrição:** Implementar `SessionDraft` + `saveDraft/loadDraft/clearDraft/elapsedFrom` com
    versão de schema e tolerância a `localStorage` ausente/quota.
  - **Arquivos envolvidos:** `src/lib/session-draft.ts`
  - **Critério de conclusão:** Round-trip funciona; `elapsedFrom` calcula por timestamp; erros não
    propagam.
  - **Dependências:** Nenhuma
  - **Estimativa:** Média

- [x] **T-002:** Definir chave estável da sessão e versão
  - **Descrição:** Função de chave a partir de `programDayId`/`dayCode`/`freestyle`; constante `v`.
  - **Arquivos envolvidos:** `src/lib/session-draft.ts`
  - **Critério de conclusão:** Chaves distintas para sessões distintas; incompatível é descartado.
  - **Dependências:** T-001
  - **Estimativa:** Pequena

### Fase 2: Implementação Core

- [x] **T-003:** Tornar o cronômetro resiliente a reload
  - **Descrição:** Trocar o `elapsed` por contador derivado de `startedAt`/`accumulatedMs`
    (`elapsedFrom`), mantendo a exibição de 1s.
  - **Arquivos envolvidos:** `src/components/WorkoutPlayer.tsx`
  - **Critério de conclusão:** F5 no meio do treino mantém o tempo correto (CA-002).
  - **Dependências:** T-001
  - **Estimativa:** Média

- [x] **T-004:** Persistir e rehidratar o estado do player
  - **Descrição:** No mount, `loadDraft(key)` e rehidratar `entries/step`; a cada mudança,
    `saveDraft` (debounce ~500ms).
  - **Arquivos envolvidos:** `src/components/WorkoutPlayer.tsx`, `src/lib/session-draft.ts`
  - **Critério de conclusão:** Sair/voltar e refresh preservam o progresso (CA-001, CA-002, CA-003).
  - **Dependências:** T-001, T-002, T-003
  - **Estimativa:** Grande

- [x] **T-005:** Botão "Minimizar" + barra de retomada
  - **Descrição:** Botão no player que volta à Início mantendo o draft; `ResumeWorkoutBar` aparece
    quando há draft e o usuário não está no player.
  - **Arquivos envolvidos:** `src/components/ResumeWorkoutBar.tsx`, `src/components/WorkoutPlayer.tsx`,
    `src/app/treinar/[day]/page.tsx`, `src/app/treinar/avulso/page.tsx`, `src/components/Nav.tsx`
  - **Critério de conclusão:** Minimizar e retomar volta ao ponto exato (CA-006).
  - **Dependências:** T-004
  - **Estimativa:** Grande

- [x] **T-006:** Edição/exclusão de holds e ajuste pós-registro
  - **Descrição:** Tocar num chip de hold abre edição (valor) / exclusão; recalcular máx/total;
    permitir corrigir o tempo quando atrasou.
  - **Arquivos envolvidos:** `src/components/WorkoutPlayer.tsx`
  - **Critério de conclusão:** Editar/excluir hold reflete em máx/total (CA-004).
  - **Dependências:** T-004
  - **Estimativa:** Média

- [x] **T-007:** Limpeza do draft no salvar/descartar
  - **Descrição:** `clearDraft` após `saveWorkout` OK e num "descartar treino" com confirmação.
  - **Arquivos envolvidos:** `src/components/WorkoutPlayer.tsx`
  - **Critério de conclusão:** Após salvar/descartar, não há retomada fantasma (CA-005).
  - **Dependências:** T-004
  - **Estimativa:** Pequena

### Fase 3: Testes e Validação

- [ ] **T-008:** Verificação do módulo de draft + percorrer CAs — **requer QA em dispositivo**
  - **Descrição:** Script/asserções para `session-draft`; rodar CA-001..006 no preview.
  - **Arquivos envolvidos:** `scripts/verify-session-draft.ts`, `src/components/WorkoutPlayer.tsx`
  - **Critério de conclusão:** Round-trip OK; CAs verdes; `npm run build` passa.
  - **Dependências:** T-004..T-007
  - **Estimativa:** Média
  - **Status:** Parcial. `npm run build` e `tsc --noEmit` passam (módulo puro e player
    compilam limpos). O script dedicado `scripts/verify-session-draft.ts` **não foi criado**
    e os CA-001..006 (persistência no F5, minimizar/retomar, edição de hold) só podem ser
    confirmados rodando o preview/app real — **requer QA em dispositivo**.

### Fase 4: Documentação e Finalização

- [x] **T-009:** Atualizar status e README
  - **Descrição:** Marcar CAs concluídos na spec; atualizar `implementation/README.md`.
  - **Arquivos envolvidos:** `implementation/011 - .../spec.md`, `implementation/README.md`
  - **Critério de conclusão:** Status e progresso refletem a realidade.
  - **Dependências:** T-008
  - **Estimativa:** Pequena

---

## Registro de Progresso

| Tarefa | Status | Data de Conclusão | Observações |
|--------|--------|-------------------|-------------|
| T-001  | ✅ Concluída | 2026-06-23 | `src/lib/session-draft.ts` — save/load/clear/elapsedFrom + versão `v` |
| T-002  | ✅ Concluída | 2026-06-23 | Chave estável por programDayId/dayCode/freestyle; incompatível descartado |
| T-003  | ✅ Concluída | 2026-06-23 | `elapsed` derivado de `startedAt`/`accumulatedMs` (resiliente a reload) |
| T-004  | ✅ Concluída | 2026-06-23 | Rehidratação no mount + saveDraft debounced no `WorkoutPlayer` |
| T-005  | ✅ Concluída | 2026-06-23 | Botão "minimizar" + `ResumeWorkoutBar` montada em `layout.tsx` |
| T-006  | ✅ Concluída | 2026-06-23 | `editHold` (editar/excluir via prompt); máx/total recalculam |
| T-007  | ✅ Concluída | 2026-06-23 | `clearDraft` no salvar e no "descartar treino" (com confirmação) |
| T-008  | 🟡 Parcial | 2026-06-23 | build/tsc passam; script `verify-session-draft.ts` não criado; **CAs requerem QA em dispositivo** |
| T-009  | ✅ Concluída | 2026-06-23 | Spec/tasks/README atualizados |

---

> **📌 NOTA:** Atualize este documento conforme as tarefas forem concluídas.
