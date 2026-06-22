# Tarefas: Templates de Programa e Geração de Plano por IA

> **Implementação:** 008 - Templates de Programa e Geração de Plano por IA
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 8/10 tarefas de código concluídas (T-009/T-010 cobertos por teste offline; testes ao vivo com OpenAI real = portão humano)
> **Última atualização:** 2026-06-22

---

## Legenda
- `[ ]` Pendente · `[x]` Concluída · `[!]` Bloqueada · `[-]` Cancelada

---

## Tarefas

### Fase 1: Templates e schema

- [x] **T-001:** Templates por arquétipo/skill
  - **Descrição:** 6 templates (força geral + saúde + 4 skills: front-lever, planche, handstand, muscle-up), com dias, slots referenciando SLUGS da biblioteca (005), alternativas por equipamento e regressões por lesão. `selectTemplate()` seleciona determinístico.
  - **Arquivos envolvidos:** `supabase/seeds/templates.ts`
  - **Critério de conclusão:** Templates curados; `verify:plan` confirma que todo slug existe na biblioteca. **Revisão clínica final = portão humano.**
  - **Dependências:** Nenhuma
  - **Estimativa:** Grande

- [x] **T-002:** JSON Schema do plano (structured output)
  - **Descrição:** `buildPlanSchema(slugs)` devolve `response_format` json_schema (strict) com `slug` restrito por enum à biblioteca (IA não inventa). `aiPlanToDraft()` mapeia a saída → `ProgramDraft` (003), resolvendo slug→exercise_id.
  - **Arquivos envolvidos:** `src/lib/plan-schema.ts`
  - **Critério de conclusão:** Schema válido e mapeável; coberto no `verify:plan`.
  - **Dependências:** Nenhuma
  - **Estimativa:** Média

### Fase 2: Validação

- [x] **T-003:** Camada de sanidade
  - **Descrição:** `validatePlan()` PURO: clampa descanso (≥45s força / ≥90s skill), holds (≤30s), reps (≤30), volume diário (≤28 séries), exercícios/dia (≤8); poda exercícios fora da biblioteca, equipamento ausente e slugs banidos por PAR-Q; corta frequência à disponibilidade. `LIMITS` exporta os tetos clínicos. `issuesFeedback()` realimenta a IA.
  - **Arquivos envolvidos:** `src/lib/plan-validator.ts`
  - **Critério de conclusão:** Rejeita/ajusta planos fora dos limites — coberto no `verify:plan`.
  - **Dependências:** T-002
  - **Estimativa:** Média

- [x] **T-004:** Fallback determinístico (template base)
  - **Descrição:** `buildFromTemplate()` PURO: parametriza o template pelo perfil — `pickLeverSlug()` escolhe a alavanca pelo benchmark do exame físico, `resolveSlot()` troca por equipamento ausente, poda opcionais por tempo de sessão e dias por disponibilidade. Sempre produz plano coerente sem IA.
  - **Arquivos envolvidos:** `src/lib/plan-generator.ts`, `src/lib/plan-catalog.ts`
  - **Critério de conclusão:** Plano coerente sem IA (3 perfis verdes no `verify:plan`).
  - **Dependências:** T-001, T-003
  - **Estimativa:** Média

### Fase 3: Geração por IA

- [x] **T-005:** Prompt + chamada estruturada
  - **Descrição:** `generatePlanWithAI()` em `ai.ts`: system+user prompt (perfil + template + restrições + feedback) e `chat.completions.create` com `response_format` structured output. Retorna `AiPlan` parseado. Só roda com `OPENAI_API_KEY`.
  - **Arquivos envolvidos:** `src/lib/plan-generator.ts`, `src/lib/ai.ts`
  - **Critério de conclusão:** Retorna plano estruturado. **Teste com OpenAI real = portão humano** (custo de API).
  - **Dependências:** T-002
  - **Estimativa:** Grande

- [x] **T-006:** Loop gerar→validar→regenerar/fallback
  - **Descrição:** `generatePlan()` com IA INJETADA (testável offline): tenta a IA até `maxRetries`, valida cada saída, realimenta o feedback das issues; se nunca passar (ou sem IA), cai no `buildFromTemplate`. Sempre retorna plano válido + trilha (`origin`, `attempts`).
  - **Arquivos envolvidos:** `src/lib/plan-generator.ts`
  - **Critério de conclusão:** Sempre produz um plano válido (loop coberto com IA mockada no `verify:plan`).
  - **Dependências:** T-003, T-004, T-005
  - **Estimativa:** Média

- [x] **T-007:** Persistir como programa ativo + metas
  - **Descrição:** `generateProgramFromProfile()` em `programs.ts`: constrói o `SlugCatalog` (biblioteca real ou seeds), orquestra `generatePlan` com a IA resolvida de `ai.ts`, mapeia → `ProgramDraft` (003) e persiste via `insertProgramDraft` como ativo, gravando auditoria em `programs.meta` (templateId, model, inputProfileHash, origin, attempts, issues). Action `gerarPlano()`. Metas iniciais ficam para 009 (milestones derivam do programa+perfil ativos).
  - **Arquivos envolvidos:** `src/lib/programs.ts`, `src/app/onboarding/actions.ts`, `src/lib/program-types.ts`, `supabase/migrations/008_program_meta.sql`
  - **Critério de conclusão:** Programa salvo e ativo. **Aplicação da migração 008 = portão humano.**
  - **Dependências:** T-006
  - **Estimativa:** Média

### Fase 4: UX e validação

- [x] **T-008:** Tela "gerando seu plano" + revisão
  - **Descrição:** `PlanGenerator` (client) dispara `gerarPlano`, mostra estado "montando seu plano", e ao terminar um resumo (origem ai/fallback + issues ajustadas) com CTA "começar a treinar"/"gerar de novo". Página `onboarding/plano` traz o resumo do perfil + disclaimer PAR-Q + caminhos de fallback (builder / plano-modelo). Identidade visual preservada.
  - **Arquivos envolvidos:** `src/app/onboarding/plano/page.tsx`, `src/components/PlanGenerator.tsx`
  - **Critério de conclusão:** Usuário vê e confirma o plano. Telas existentes intactas (build verde).
  - **Dependências:** T-007
  - **Estimativa:** Média

- [x] **T-009:** Testes dos 3 perfis *(offline)*
  - **Descrição:** `verify:plan` gera para skill/força/saúde e valida segurança (limites, frequência, ≥2 ex/dia, source=ai). **Execução no player ao vivo + revisão clínica = portão humano.**
  - **Arquivos envolvidos:** `scripts/verify-plan.ts`
  - **Critério de conclusão:** Planos válidos (verde offline); executáveis no player = teste ao vivo (humano).
  - **Dependências:** T-007
  - **Estimativa:** Média

- [x] **T-010:** Teste de casos de borda *(offline)*
  - **Descrição:** `verify:plan` cobre lesão grave (PAR-Q block poda holds pesados), sem equipamento (nenhum exercício que exige equipamento), 2 dias/semana, e saída malformada/slug-inventado da IA (→ fallback). Tudo sem rede (IA mockada).
  - **Arquivos envolvidos:** `scripts/verify-plan.ts`
  - **Critério de conclusão:** Comportamento seguro em todos (verde offline).
  - **Dependências:** T-006
  - **Estimativa:** Pequena

---

## Registro de Progresso

| Tarefa | Status | Data | Observações |
|--------|--------|------|-------------|
| T-001 | ✅ Código | 2026-06-22 | 6 templates (`templates.ts`); revisão clínica = humano |
| T-002 | ✅ Código | 2026-06-22 | `plan-schema.ts` (json_schema strict + enum de slug) |
| T-003 | ✅ Código | 2026-06-22 | `plan-validator.ts` (clamp/poda + LIMITS) |
| T-004 | ✅ Código | 2026-06-22 | `buildFromTemplate` + `plan-catalog.ts` |
| T-005 | ✅ Código | 2026-06-22 | `ai.ts::generatePlanWithAI`; teste OpenAI real = humano |
| T-006 | ✅ Código | 2026-06-22 | `generatePlan` (loop+fallback, IA injetada) |
| T-007 | ✅ Código | 2026-06-22 | `generateProgramFromProfile` + `gerarPlano` + meta/migração 008 |
| T-008 | ✅ Código | 2026-06-22 | `PlanGenerator.tsx` + `onboarding/plano` |
| T-009 | ✅ Offline | 2026-06-22 | 3 perfis verdes em `verify:plan`; player ao vivo = humano |
| T-010 | ✅ Offline | 2026-06-22 | bordas (lesão/sem equip/2 dias/IA malformada) verdes |

## Portões humanos (008)

1. Aplicar `supabase/migrations/008_program_meta.sql` no SQL Editor (coluna `programs.meta`).
2. Migrações 003 + 007 aplicadas; conteúdo 005 **semeado** (slugs do enum precisam existir na biblioteca para o draft trazer `exercise_id` real; sem seed, o draft cai em nome livre, que o runtime 004 tolera).
3. `OPENAI_API_KEY` (+ `OPENAI_MODEL`) local + Vercel — sem ela, a geração usa só o fallback determinístico.
4. Teste e2e com OpenAI real: anamnese → `gerarPlano` → player; **revisão clínica/segurança do plano gerado** (julgamento de domínio + custo de API).
5. (Opcional/035) Runner vitest — a cobertura de regra já roda offline via `npm run verify:plan`.
