# Tarefas: Construtor de Treinos Manual e Sessão Avulsa (Freestyle)

> **Implementação:** 006 - Construtor de Treinos Manual e Sessão Avulsa (Freestyle)
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 8/9 tarefas de código concluídas (T-009 = portão humano: e2e ao vivo)
> **Última atualização:** 2026-06-22

---

## Legenda
- `[ ]` Pendente · `[x]` Concluída · `[!]` Bloqueada · `[-]` Cancelada

---

## Tarefas

### Fase 1: Seleção de exercícios

- [x] **T-001:** Componente ExercisePicker
  - **Descrição:** Busca na biblioteca (filtro por padrão/equipamento) + opção "criar exercício custom".
  - **Arquivos envolvidos:** `src/components/ExercisePicker.tsx`, `src/lib/exercise-catalog.ts`, `src/lib/programs.ts` (`getExerciseCatalog`)
  - **Critério de conclusão:** Seleciona da biblioteca e cria custom. ✔ (catálogo real 005 com fallback PLAN offline)
  - **Dependências:** Nenhuma
  - **Estimativa:** Média

- [x] **T-002:** Criar exercício custom
  - **Descrição:** Ação que insere em `exercise_library` com `owner_user_id`.
  - **Arquivos envolvidos:** `src/app/actions.ts` (`createCustomExerciseAction`), `src/lib/programs.ts` (`createCustomExercise`)
  - **Critério de conclusão:** Custom criado e reutilizável. ✔ (slug idempotente por dono → reutiliza; CA-003)
  - **Dependências:** T-001
  - **Estimativa:** Pequena

### Fase 2: Builder de rotina

- [x] **T-003:** UI do RoutineBuilder
  - **Descrição:** Nomear rotina, adicionar dias, adicionar exercícios via picker, definir alvos (séries×reps/hold, RIR, descanso).
  - **Arquivos envolvidos:** `src/components/RoutineBuilder.tsx`, `src/app/montar/page.tsx`
  - **Critério de conclusão:** Monta uma rotina completa. ✔
  - **Dependências:** T-001
  - **Estimativa:** Grande

- [x] **T-004:** Salvar/ativar rotina
  - **Descrição:** Persistir como `program` (source=manual) com dias/exercícios; marcar ativa.
  - **Arquivos envolvidos:** `src/app/actions.ts` (`saveRoutine`), `src/lib/routine.ts` (`buildRoutineDraft` puro), `src/lib/programs.ts` (`insertProgramDraft`/`setActiveProgram`)
  - **Critério de conclusão:** Rotina salva e ativável. ✔ (validação pura + insert via draft 003)
  - **Dependências:** T-003
  - **Estimativa:** Média

- [-] **T-005:** Editar rotina existente
  - **Descrição:** Reabrir e alterar dias/exercícios/alvos.
  - **Arquivos envolvidos:** `src/app/montar/[id]/page.tsx`
  - **Critério de conclusão:** Edição persiste.
  - **Observação:** **Fora da fatia v1** do roadmap (§4.9 lista builder/avulso, não a edição). Adiado p/ iteração futura.
  - **Dependências:** T-004
  - **Estimativa:** Média

### Fase 3: Sessão avulsa

- [x] **T-006:** Fluxo de sessão avulsa
  - **Descrição:** "Treino de hoje" vazio; adicionar exercícios em runtime; usar o player; salvar `entries` sem `program_day_id`.
  - **Arquivos envolvidos:** `src/app/treinar/avulso/page.tsx`, `src/components/WorkoutPlayer.tsx` (props `freestyle`/`catalog`, estado vazio, add-exercise + picker)
  - **Critério de conclusão:** Avulso registra e salva. ✔ (reusa player/timers/voz; salva via `saveWorkout`, day_code=AVULSO)
  - **Dependências:** T-001
  - **Estimativa:** Grande

### Fase 4: Integração e validação

- [x] **T-007:** Pontos de entrada nas telas
  - **Descrição:** Botões "montar treino" e "sessão avulsa" em Início/Treinar.
  - **Arquivos envolvidos:** `src/app/page.tsx`, `src/app/treinar/TreinarPicker.tsx`
  - **Critério de conclusão:** Acessível em 1 toque. ✔
  - **Dependências:** T-004, T-006
  - **Estimativa:** Pequena

- [x] **T-008:** Histórico/progressão incluem freestyle
  - **Descrição:** Garantir que sessões avulsas e rotinas manuais aparecem normalmente.
  - **Arquivos envolvidos:** `src/app/historico/page.tsx` (rótulo "Sessão avulsa" p/ code AVULSO)
  - **Critério de conclusão:** Aparecem como qualquer sessão. ✔ (já gravam em sessions/entries; rótulo amigável adicionado)
  - **Dependências:** T-006
  - **Estimativa:** Pequena

- [!] **T-009:** Teste ponta a ponta freestyle
  - **Descrição:** Montar rotina → treinar; e sessão avulsa → salvar; conferir histórico.
  - **Arquivos envolvidos:** `scripts/verify-routine.ts` (cobertura offline das funções puras)
  - **Critério de conclusão:** Ambos os fluxos validados. ⏳ **Portão humano:** e2e ao vivo precisa de 002/003 aplicadas + sessão de usuário real (Supabase). Cobertura offline verde (`npm run verify:routine`).
  - **Dependências:** T-007, T-008
  - **Estimativa:** Pequena

---

## Registro de Progresso

| Tarefa | Status | Data | Observações |
|--------|--------|------|-------------|
| T-001 | ✅ Código | 2026-06-22 | ExercisePicker + catálogo (lib 005 c/ fallback PLAN offline). |
| T-002 | ✅ Código | 2026-06-22 | createCustomExercise idempotente (reutiliza por slug+dono). |
| T-003 | ✅ Código | 2026-06-22 | RoutineBuilder (estado local) + /montar. |
| T-004 | ✅ Código | 2026-06-22 | saveRoutine + buildRoutineDraft puro + insertProgramDraft. |
| T-005 | ➖ Adiado | 2026-06-22 | Fora da fatia v1 (§4.9). Iteração futura (/montar/[id]). |
| T-006 | ✅ Código | 2026-06-22 | WorkoutPlayer freestyle + /treinar/avulso. |
| T-007 | ✅ Código | 2026-06-22 | Atalhos em Início e Treinar. |
| T-008 | ✅ Código | 2026-06-22 | Histórico já inclui; rótulo "Sessão avulsa". |
| T-009 | 🚧 Portão humano | 2026-06-22 | Offline verde; e2e ao vivo exige Supabase aplicado. |
