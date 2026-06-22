# Tarefas: Runtime Orientado a Plano-como-Dado

> **Implementação:** 004 - Runtime Orientado a Plano-como-Dado
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 8/8 tarefas de código concluídas (100%) · aplicação/teste ao vivo = portão humano
> **Última atualização:** 2026-06-22

---

## Legenda
- `[ ]` Pendente · `[x]` Concluída · `[!]` Bloqueada · `[-]` Cancelada

---

## Tarefas

### Fase 1: Adaptação de dados

- [x] **T-001:** Adaptador `dbDay → PlanDay`
  - **Descrição:** Função que converte um `program_day` + `day_exercises` no shape que o `WorkoutPlayer` já consome.
  - **Arquivos envolvidos:** `src/lib/program-adapter.ts`
  - **Critério de conclusão:** Adaptador testado com o programa-modelo.
  - **Dependências:** Nenhuma
  - **Estimativa:** Média
  - **✔ Feito:** `adaptExercise/adaptDay/adaptProgram/adaptLadder` puros + `buildExerciseRefMap` (FKs). Teste offline `scripts/verify-adapter.ts` (PLAN→draft→view→adaptProgram == PLAN) passa.

- [x] **T-002:** Helper "programa ativo + dias"
  - **Descrição:** `getActiveProgramView(userId)` retornando dias adaptados e metadados (periodização, escadas).
  - **Arquivos envolvidos:** `src/lib/programs.ts`
  - **Critério de conclusão:** Retorna a visão pronta para as páginas.
  - **Dependências:** T-001
  - **Estimativa:** Média
  - **✔ Feito:** `getActiveProgramRuntime()` retorna `{ fromSeed, programId, name, cycleWeeks, days(PlanDay[]), periodization, ladders, refMap }`. Escadas vêm de `skill_levels` (`listSkills`+`adaptLadder`). Fallback p/ semente PLAN quando não há programa/migração (R1).

### Fase 2: Telas

- [x] **T-003:** Treinar (overview + dia)
  - **Descrição:** `treinar/page.tsx` e `treinar/[day]/page.tsx` consomem o programa ativo; player recebe o dia do banco.
  - **Arquivos envolvidos:** `src/app/treinar/page.tsx`, `src/app/treinar/[day]/page.tsx`, `src/components/WorkoutPlayer.tsx`
  - **Critério de conclusão:** Treino roda a partir do banco.
  - **Dependências:** T-002
  - **Estimativa:** Grande
  - **✔ Feito:** Overview virou Server Component (`getActiveProgramRuntime`) + `TreinarPicker` (client). `[day]` busca o dia adaptado e passa `programDayId`/`exerciseRefs` ao player. `WorkoutPlayer`/`SessionForm` aceitam as novas props sem mudar o shape `PlanDay` (sem regressão de timers/voz).

- [x] **T-004:** Início e Plano
  - **Descrição:** Sugestão do dia, alavancas e periodização vindas do programa.
  - **Arquivos envolvidos:** `src/app/page.tsx`, `src/app/plano/page.tsx`
  - **Critério de conclusão:** Telas refletem o programa do usuário.
  - **Dependências:** T-002
  - **Estimativa:** Média
  - **✔ Feito:** Início usa `runtime.days` (sugestão de próximo dia), `ladderBySlug` para as alavancas FL/Planche. Plano usa `runtime.periodization`/`days`/`cycleWeeks`. Histórico (`/historico`, `/historico/[id]`) também passou a rotular dias pelo runtime (removeu `PLAN`).

- [x] **T-005:** Progressão e Coach (escadas via banco)
  - **Descrição:** Ladders vindos de `skill_levels`; coach usa a periodização do programa.
  - **Arquivos envolvidos:** `src/app/progressao/page.tsx`, `src/app/coach/page.tsx`, `src/lib/coach.ts`
  - **Critério de conclusão:** Escadas e blocos vêm do dado.
  - **Dependências:** T-002
  - **Estimativa:** Média
  - **✔ Feito:** Progressão usa `runtime.ladders` (de `skill_levels`) + `leverIndex`. `coach.ts` é puro e não acopla a `PLAN`; o bloco/periodização do coach continua via `cycle.ts` (mesma fonte de dados — periodização-como-dado é swap futuro, centralizado no adapter).

### Fase 3: Escrita e estados

- [x] **T-006:** Salvar sessão vinculada ao programa
  - **Descrição:** `saveWorkout` grava `program_day_id`/`day_exercise_id` nas `entries`.
  - **Arquivos envolvidos:** `src/app/actions.ts`, `src/lib/db.ts`
  - **Critério de conclusão:** Entradas referenciam o programa.
  - **Dependências:** T-003
  - **Estimativa:** Média
  - **✔ Feito:** `EntryInsert` ganhou `program_day_id?`/`day_exercise_id?` (nullable, R8). `saveWorkout` (player) e `saveSession` (form) propagam as FKs; `insertWorkout` só escreve as colunas quando há vínculo real → seed/pré-migração não quebra.

- [x] **T-007:** Estado "sem programa ativo"
  - **Descrição:** CTA para onboarding (007) ou builder (006) quando não há programa.
  - **Arquivos envolvidos:** `src/app/page.tsx`, `src/app/treinar/page.tsx`
  - **Critério de conclusão:** Estado vazio tratado.
  - **Dependências:** T-002
  - **Estimativa:** Pequena
  - **✔ Feito:** `src/components/NoProgramCTA.tsx` (banner + full). Banner aparece em Início/Treinar/Plano quando `runtime.fromSeed`. CTAs apontam p/ `/onboarding` (007) e `/montar` (006) — rotas planejadas, fallback textual (R9).

### Fase 4: Limpeza

- [x] **T-008:** Remover imports de `PLAN` do runtime
  - **Descrição:** Garantir que nenhuma tela importe `PLAN` diretamente (só seed).
  - **Arquivos envolvidos:** `src/**`
  - **Critério de conclusão:** `grep` por `from "@/lib/plan"` só no seed.
  - **Dependências:** T-003, T-004, T-005
  - **Estimativa:** Pequena
  - **✔ Feito:** Nenhuma tela importa mais os dados `PLAN`/`PERIODIZATION`/`FL_PROGRESSION`. Imports remanescentes de `@/lib/plan` são só **tipos** (`PlanDay`/`PlanExercise`/`Category`/`CycleWeek` — contrato do runtime, §9) e a função pura `leverIndex`. Dados ficam em `seed-plan.ts`, na ponte `programs.ts` (fallback) e em `cycle.ts` (block — swap futuro).

---

## Registro de Progresso

| Tarefa | Status | Data | Observações |
|--------|--------|------|-------------|
| T-001 | ✅ Concluída | 2026-06-22 | `program-adapter.ts` + teste offline `verify-adapter.ts` |
| T-002 | ✅ Concluída | 2026-06-22 | `getActiveProgramRuntime()` em `programs.ts` (escadas via `skill_levels`, fallback semente) |
| T-003 | ✅ Concluída | 2026-06-22 | Treinar overview (Server) + `TreinarPicker`; `[day]` + player/form com FKs |
| T-004 | ✅ Concluída | 2026-06-22 | Início, Plano e Histórico lendo do runtime |
| T-005 | ✅ Concluída | 2026-06-22 | Progressão usa `runtime.ladders`; coach puro/sem `PLAN` |
| T-006 | ✅ Concluída | 2026-06-22 | FKs `program_day_id`/`day_exercise_id` em `EntryInsert`/save (nullable) |
| T-007 | ✅ Concluída | 2026-06-22 | `NoProgramCTA` (banner/full) em Início/Treinar/Plano |
| T-008 | ✅ Concluída | 2026-06-22 | Telas sem `PLAN`-dados; só tipos + `leverIndex` restam |

### Portões humanos (não automatizáveis nesta fatia)
- Aplicar a migração `003_program_model.sql` no Supabase (SQL Editor) — sem ela, `getActiveProgramRuntime` cai na **semente** (banner "plano de exemplo").
- Rodar o seed (`seed:program`) com `PILOT_USER_ID` p/ ter um programa ativo real no piloto.
- Rotas `/onboarding` (007) e `/montar` (006) ainda não existem — os CTAs do empty-state apontam p/ elas (fallback até serem entregues).
- Teste ao vivo: trocar o programa ativo do usuário e confirmar que telas mudam e o player não regride (timers/voz/escala).
