# Tarefas: Reclassificação de Exercícios (Estáticos × Dinâmicos)

> **Implementação:** 013 - Reclassificação de Exercícios (Estáticos × Dinâmicos)
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 5/7 tarefas concluídas (71%)
> **Última atualização:** 2026-06-23

---

## Legenda
- `[ ]` — Pendente · `[x]` — Concluída · `[!]` — Bloqueada · `[-]` — Cancelada

---

## Tarefas

### Fase 1: Preparação e Setup

- [x] **T-001:** Criar a classificação de movimento (pura)
  - **Descrição:** `isStatic`/`movementType` derivando da unidade-alvo (`seconds`×`reps`) com fallback
    `isSkill` isométrico.
  - **Arquivos envolvidos:** `src/lib/exercise-classify.ts`
  - **Critério de conclusão:** Casos `seconds`/`reps`/ausente cobertos; pura e testável.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

- [x] **T-002:** Garantir a unidade-alvo nos dados de runtime
  - **Descrição:** Propagar `target_unit`/`default_unit`/`unit` até o player (adaptação de programa,
    `EntryState`); conferir seeds estáticos.
  - **Arquivos envolvidos:** `src/lib/program-adapter.ts`, `src/lib/plan.ts`,
    `src/lib/exercise-catalog.ts`, `supabase/seeds/templates.ts`, `supabase/seeds/exercises.ts`
  - **Critério de conclusão:** O player tem acesso à unidade de cada exercício.
  - **Dependências:** T-001
  - **Estimativa:** Média

### Fase 2: Implementação Core

- [x] **T-003:** Player escolhe o modo por `isStatic`
  - **Descrição:** Trocar o branch `cur.isSkill` por `isStatic(cur)` para decidir cronômetro de hold ×
    contador de séries; `EntryState` carrega `unit`/`isStatic`.
  - **Arquivos envolvidos:** `src/components/WorkoutPlayer.tsx`
  - **Critério de conclusão:** Hollow hold abre cronômetro; pull-up abre séries (CA-001, CA-002).
  - **Dependências:** T-001, T-002
  - **Estimativa:** Média

- [x] **T-004:** Rótulo/chip do eixo movimento
  - **Descrição:** Exibir ESTÁTICO/DINÂMICO (mantendo categoria/cor) nos chips de treinar/picker/sessão.
  - **Arquivos envolvidos:** `src/components/ui.tsx`, `src/components/WorkoutPlayer.tsx`,
    `src/app/treinar/TreinarPicker.tsx`, `src/components/ExercisePicker.tsx`
  - **Critério de conclusão:** Chips corretos em todas as telas (CA-003).
  - **Dependências:** T-001
  - **Estimativa:** Média

### Fase 3: Testes e Validação

- [ ] **T-005:** Testes da classificação
  - **Descrição:** Unit de `isStatic/movementType` (unidade + fallback); amostra de exercícios.
  - **Arquivos envolvidos:** `scripts/verify-classify.ts`, `src/lib/exercise-classify.ts`
  - **Critério de conclusão:** Unit verdes para FL, hollow hold, pull-up, muscle-up, prancha.
  - **Dependências:** T-001..T-004
  - **Estimativa:** Pequena
  - **Status:** Parcial. `isStatic`/`movementType` são puros e tipados (compilam limpo, build OK),
    mas o script dedicado `scripts/verify-classify.ts` **não foi criado** — não há asserção
    automatizada cobrindo FL/hollow hold/pull-up/muscle-up/prancha. Pendente de criar o script.

- [x] **T-006:** Retrocompatibilidade + verificações de conteúdo
  - **Descrição:** Abrir planos/histórico antigos sem erro; rodar `verify:plan`/`verify:content` após
    ajustes de unidade nos seeds; `npm run build`.
  - **Arquivos envolvidos:** `supabase/seeds/*`, `src/components/WorkoutPlayer.tsx`
  - **Critério de conclusão:** CA-004 verde; verificações passam.
  - **Dependências:** T-003, T-005
  - **Estimativa:** Média
  - **Status:** `npm run verify:plan` e `npm run verify:content` passam (EXIT 0 — "54 exercícios,
    5 escadas"); `npm run build` e `tsc --noEmit` passam. A classificação tem fallback `isSkill`
    para unidade ausente, então planos/histórico antigos não quebram. **Ressalva (limitação prevista,
    spec §3.6):** no fallback PLAN embutido, "Hollow body hold" (`plan.ts`) não expõe unidade nem
    `isSkill`, então via `fromPlan` é classificado como dinâmico; o caminho real de runtime
    (catálogo/`day_exercises.target_unit`) classifica corretamente como estático. A confirmação
    visual final de CA-004 (abrir histórico antigo no app real) **requer QA em dispositivo**.

### Fase 4: Documentação e Finalização

- [x] **T-007:** Atualizar status e README
  - **Descrição:** Marcar CAs concluídos; atualizar `implementation/README.md`; documentar a opção
    futura de coluna `movement_type`.
  - **Arquivos envolvidos:** `implementation/013 - .../spec.md`, `implementation/README.md`
  - **Critério de conclusão:** Status/progresso refletem a realidade.
  - **Dependências:** T-006
  - **Estimativa:** Pequena

---

## Registro de Progresso

| Tarefa | Status | Data de Conclusão | Observações |
|--------|--------|-------------------|-------------|
| T-001  | ✅ Concluída | 2026-06-23 | `src/lib/exercise-classify.ts` — `isStatic`/`movementType` + fallback `isSkill` |
| T-002  | ✅ Concluída | 2026-06-23 | `unit`/`defaultUnit` propagados ao player (`fromOption`/`fromPlan`) |
| T-003  | ✅ Concluída | 2026-06-23 | Modo do player por `cur.isStatic` (não mais `isSkill`); `saveWorkout` grava por `isStatic` |
| T-004  | ✅ Concluída | 2026-06-23 | `MovementChip` (ESTÁTICO/DINÂMICO) em WorkoutPlayer/TreinarPicker/ExercisePicker |
| T-005  | 🟡 Parcial | 2026-06-23 | lógica pura/tipada e build OK; script `verify-classify.ts` **não criado** |
| T-006  | ✅ Concluída | 2026-06-23 | verify:plan/verify:content/build passam; fallback preserva retrocompat (ressalva: fallback PLAN do hollow hold; CA-004 visual requer QA) |
| T-007  | ✅ Concluída | 2026-06-23 | Spec/tasks/README atualizados |

---

> **📌 NOTA:** Atualize este documento conforme as tarefas forem concluídas.
