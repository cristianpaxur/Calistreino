# Tarefas: Onboarding com Bifurcação e Anamnese Estruturada

> **Implementação:** 007 - Onboarding com Bifurcação e Anamnese Estruturada
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 9/9 tarefas de código concluídas (100%) — aplicação SQL + revisão jurídica/curadoria são portões humanos
> **Última atualização:** 2026-06-22

---

## Legenda
- `[ ]` Pendente · `[x]` Concluída · `[!]` Bloqueada · `[-]` Cancelada

---

## Tarefas

### Fase 1: Modelo e schema do perfil

- [x] **T-001:** Tabela `profiles` + RLS *(código)*
  - **Descrição:** Criar `profiles` por usuário (arquétipo, perfil, benchmarks jsonb, health_flags, logística, preferências).
  - **Arquivos envolvidos:** `supabase/migrations/007_profiles.sql`, `supabase/schema.sql` (comentário)
  - **Critério de conclusão:** SQL versionado (PK=user_id default auth.uid(), RLS por user_id, FK on delete cascade). **Aplicação no Supabase = portão humano.**
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

- [x] **T-002:** Schema do perfil + banco de perguntas
  - **Descrição:** Definir tipos do `profile` e a estrutura de perguntas por seção/arquétipo (com ramificação).
  - **Arquivos envolvidos:** `src/lib/anamnese.ts`
  - **Critério de conclusão:** `AnamneseProfile`, `SECTIONS`, `Question`, `sectionsFor`, `validateProfile`, `evaluateParq`, `buildProfile` — todos puros. ✔
  - **Dependências:** Nenhuma
  - **Estimativa:** Média

### Fase 2: Fork

- [x] **T-003:** Tela de bifurcação pós-cadastro
  - **Descrição:** Escolha guiado × freestyle; encaminhamento e reversibilidade.
  - **Arquivos envolvidos:** `src/app/onboarding/page.tsx`, `src/components/OnboardingFork.tsx`, `src/app/onboarding/actions.ts` (`chooseOnboardingPath`)
  - **Critério de conclusão:** Fork navegável e reversível (destaca via atual; freestyle → /montal, guiada → /onboarding/anamnese). Tolerante à tabela ainda não aplicada (R9). ✔
  - **Dependências:** T-002
  - **Estimativa:** Média

### Fase 3: Wizard de anamnese

- [x] **T-004:** Componente AnamneseWizard (etapas)
  - **Descrição:** Multi-etapa com progresso; objetivo/arquétipo, perfil, exame físico, PAR-Q, logística, preferências.
  - **Arquivos envolvidos:** `src/components/AnamneseWizard.tsx`, `src/app/onboarding/anamnese/page.tsx`
  - **Critério de conclusão:** Percurso completo navegável, barra de progresso, validação por etapa, todos os `QuestionKind` (single/multi/number/text/parq). ✔
  - **Dependências:** T-002
  - **Estimativa:** Grande

- [x] **T-005:** Ramificação por arquétipo
  - **Descrição:** Caminho de skill (qual skill + benchmarks específicos) vs força/saúde.
  - **Arquivos envolvidos:** `src/lib/anamnese.ts` (`sectionsFor`), `src/components/AnamneseWizard.tsx`
  - **Critério de conclusão:** Seções/perguntas recomputam pelo arquétipo (skill injeta seção 'skill' + benchmark de skill; strength/health pulam). Coberto por `verify-anamnese`. ✔
  - **Dependências:** T-004
  - **Estimativa:** Média

- [x] **T-006:** Triagem de saúde (PAR-Q)
  - **Descrição:** Perguntas de saúde + flags de bloqueio/aviso e disclaimer "procure profissional".
  - **Arquivos envolvidos:** `src/lib/anamnese.ts` (`PARQ_QUESTIONS`/`evaluateParq`/`parqDisclaimer`), `src/components/AnamneseWizard.tsx`
  - **Critério de conclusão:** Níveis ok/warn/block derivados; disclaimer ao vivo. **Texto do disclaimer é provisório → revisão jurídica = portão humano.** ✔
  - **Dependências:** T-004
  - **Estimativa:** Média

- [x] **T-007:** Salvar perfil
  - **Descrição:** Persistir `profile` ao concluir; encaminhar à geração (008).
  - **Arquivos envolvidos:** `src/app/onboarding/actions.ts` (`saveAnamnese`), `src/lib/programs.ts` (`upsertProfile`/`getProfile`/`setOnboardingPath`)
  - **Critério de conclusão:** `upsertProfile` (onConflict user_id) + validação server-side; redireciona para `/onboarding/plano` (destino 008 com fallback R9). ✔
  - **Dependências:** T-001, T-004
  - **Estimativa:** Pequena

### Fase 4: Acesso posterior e validação

- [x] **T-008:** Reabrir/editar anamnese
  - **Descrição:** Link em Ajustes ("quero um plano"/"editar perfil") mesmo para quem entrou freestyle.
  - **Arquivos envolvidos:** `src/app/configuracoes/page.tsx`, `src/app/onboarding/anamnese/page.tsx`
  - **Critério de conclusão:** Card "Plano personalizado → editar a anamnese" em Ajustes; a página pré-preenche com o perfil existente (`profileToValues`). ✔
  - **Dependências:** T-007
  - **Estimativa:** Pequena

- [x] **T-009:** Teste dos 3 arquétipos *(offline)*
  - **Descrição:** Percorrer guiado para skill/força/saúde e validar os perfis salvos.
  - **Arquivos envolvidos:** `scripts/verify-anamnese.ts`, `package.json` (`verify:anamnese`)
  - **Critério de conclusão:** Script offline cobre ramificação, PAR-Q (ok/warn/block), validação e build dos 3 arquétipos — verde. **Testes ao vivo (3 arquétipos no app) = portão humano.** ✔
  - **Dependências:** T-005, T-006, T-007
  - **Estimativa:** Pequena

---

## Registro de Progresso

| Tarefa | Status | Data | Observações |
|--------|--------|------|-------------|
| T-001 | 🔵 Código | 2026-06-22 | `007_profiles.sql` escrito; aplicação no Supabase = portão humano |
| T-002 | ✅ Concluída | 2026-06-22 | `src/lib/anamnese.ts` — tudo puro |
| T-003 | ✅ Concluída | 2026-06-22 | Fork reversível + `chooseOnboardingPath` |
| T-004 | ✅ Concluída | 2026-06-22 | `AnamneseWizard` multi-etapa |
| T-005 | ✅ Concluída | 2026-06-22 | `sectionsFor` dirige a ramificação |
| T-006 | 🔵 Código | 2026-06-22 | PAR-Q ok/warn/block; disclaimer provisório → revisão jurídica |
| T-007 | ✅ Concluída | 2026-06-22 | `upsertProfile`/`getProfile`; redirect p/ 008 |
| T-008 | ✅ Concluída | 2026-06-22 | Link em Ajustes + pré-preenchimento |
| T-009 | ✅ Concluída | 2026-06-22 | `verify-anamnese` verde; ao vivo = portão humano |

---

## Portões humanos (007)

1. **Aplicar `supabase/migrations/007_profiles.sql`** no SQL Editor (PostgREST não roda DDL). Depende de 002 (auth.users + auth.uid()).
2. **Revisão jurídica do disclaimer PAR-Q** (`parqDisclaimer` em `src/lib/anamnese.ts`) — texto provisório.
3. **Curadoria final das perguntas** de força/saúde e dos benchmarks (julgamento de coach).
4. **Redirect pós-cadastro** para `/onboarding` (decisão de produto: onde plugar no fluxo de signup).
5. **Destino do fork freestyle**: hoje `/montar` (fatia 006). Confirmar quando 006 estiver fechado.
6. **Geração de plano (008)**: o wizard redireciona para `/onboarding/plano`, hoje uma página de confirmação/fallback (R9). Será substituída pela geração por IA da spec 008.
7. **Testes ao vivo dos 3 arquétipos** no app (após aplicar a migração).
