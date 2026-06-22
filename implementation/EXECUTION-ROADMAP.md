# EXECUTION ROADMAP — CalisTreino

> Tech-lead consolidation of the 10 implementation blueprints (001–010).
> Estado real do código hoje: app **single-tenant** (senha única `APP_PASSWORD` + cookie HMAC), `db.ts` usa **service_role singleton sem RLS**, schema flat (`sessions`/`entries`/`settings`), `plan.ts` **hardcoded**, `WorkoutPlayer` acoplado a um `PlanDay`. Tudo acima de 002 pressupõe a virada para Supabase Auth + modelo de dados relacional, que **ainda não existe**.

---

## 1. Caminho crítico e ordem de execução

### Grafo de dependências (depends_on)

```
001 ──> 002 ──┬──> 003 ──┬──> 004 ──────────────┐
              │          ├──> 005 ──┐            │
              │          │          ├──> 008 ──┐ │
              │          └──────────┤          ├─┼──> 009
              │                     │          │ │
              ├─────────────────────┴──> 006 <─┘ │ (006 dep: 002,003,004,005)
              │                                   │
              └──> 007 (dep: 002,003,006,008) ────┘
                                                  └──> 010 (dep: 002,008,009)
```

### Caminho crítico (mais longo)

**001 → 002 → 003 → 005 → 008 → 009 → 010**

Esta é a espinha dorsal. Cada elo é um pré-requisito duro do seguinte. 004, 006 e 007 penduram-se nessa coluna mas não a alongam.

### Ordem recomendada por ondas

| Onda | Implementações | Observação |
|------|----------------|-----------|
| **0 — Fundação** | **001** | Base de tudo. Valida Supabase real + deploy. Quase 100% human-gated. |
| **1 — Identidade** | **002** | Cutover para Supabase Auth + RLS por `auth.uid()`. Destrava o conceito de usuário que todo o resto assume. |
| **2 — Modelo de dados** | **003** | Cria programs/days/exercises + biblioteca/escadas. Pré-req de 004/005/006/008. |
| **3 — Paralelo** | **004** ∥ **005** | Independentes entre si (004 = runtime; 005 = conteúdo/seed). Podem ser codados em paralelo após 003. |
| **4 — Construção** | **006** ∥ **008** | 006 (freestyle/builder) precisa de 002+003+004+005; 008 (geração IA) precisa de 002+003+005+007. **Atenção**: 008 também depende de 007. Ver nota abaixo. |
| **5 — Onboarding** | **007** | Precisa de 002,003,006,008. É o gargalo de ciclo: 007 e 008 referenciam-se mutuamente. |
| **6 — Loop + Receita** | **009** → **010** | 009 fecha o loop adaptativo; 010 monetiza por cima de tudo. |

### Ciclo a resolver: 007 ↔ 008

007 (`depends_on` 008) e 008 (`depends_on` 007) formam dependência circular no papel. Na prática:
- 008 precisa do **contrato do `profile`** (formato de benchmarks/health_flags) que 007 define.
- 007 precisa do **destino do fork** e da tela "gerando plano" que 008 fornece.

**Mitigação**: congelar primeiro o **schema do `profile`** (tabela `profiles` + tipos `AnamneseProfile` de 007/T-001,T-002), depois construir 008 contra esse contrato, e por último ligar o wizard de 007 à ação `gerarPlano()` de 008. Trate como **uma fatia conjunta 007+008** entregue na ordem: `profiles` → 008 → wizard 007.

### O que pode ser paralelizado

- **004 ∥ 005** após 003 (runtime vs. conteúdo — zero sobreposição de arquivos).
- Dentro de cada implementação, **todas as tarefas de SQL/tipos/lib/UI** podem ser codadas antes de qualquer portão humano (ver §4).
- 010 (T-001..T-007 de código) pode ser **pré-escrita** em paralelo a 008/009, pois só o **gate** depende delas; o resto depende de Stripe (humano).

---

## 2. Tabela por implementação

| ID | Nome | Automatável | Principais arquivos | Pré-requisitos humanos |
|----|------|-------------|---------------------|------------------------|
| **001** | Verificação Supabase + Deploy Vercel | **human-gated** | `_sbapitest.mjs` (temp), `supabase/schema.sql`, `.env.example`, `.env.local`, `README.md` | Projeto Supabase ativo + chaves; aplicar `schema.sql`+`ALTER TABLE … ENABLE RLS`; **rotacionar service_role** (foi exposta); `APP_PASSWORD`+`AUTH_SECRET`; envs no Vercel; autorizar push; testes ao vivo na URL pública |
| **002** | Contas & Auth (Multi-Tenant) | **human-gated** | `src/lib/supabase-server.ts`, `supabase-browser.ts`, `migrations/002_multitenant.sql`, `002_backfill_pilot.sql`, `db.ts`, `queries.ts`, `actions.ts`, `middleware.ts`, `auth.ts`, `login/page.tsx` | Aplicar migração (user_id, PK composta settings, RLS); criar conta-piloto + uuid; **backup** antes do backfill; trocar para `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` (local+Vercel); config Confirm-email/SMTP; testes de isolamento 2 contas |
| **003** | Modelo de Dados Unificado | **partial** | `program-types.ts`, `programs.ts`, `seed-plan.ts`, `migrations/003_program_model.sql`, `scripts/seed-program.ts`, `schema.sql`, `plan.ts` | **002 concluída**; aplicar SQL no Supabase; uuid do piloto (`PILOT_USER_ID`); rodar seed; curar catálogo global vs. custom |
| **004** | Runtime Plano-como-Dado | **partial** | `program-adapter.ts`, `programs.ts`, `treinar/*`, `WorkoutPlayer.tsx`, `page.tsx`, `plano/`, `progressao/`, `coach/*`, `actions.ts`, `db.ts`, `SessionForm.tsx` | Migração 003 aplicada; seed + programa ativo no piloto; origem do `userId` (002) validada; envs Vercel; teste ao vivo de troca de programa sem regressão do player |
| **005** | Biblioteca & Escadas | **partial** | `supabase/seeds/exercises.ts`, `skills.ts`, `types.ts`, `seeds/README.md`, `scripts/seed.ts`, `scripts/tsconfig.json`, `package.json` | **003 aplicada** (tabelas+constraints unique); chaves Supabase; `npm install` do runner TS (tsx/dotenv); rodar `npm run seed` 2× (idempotência); **revisão de segurança por coach**; demo_urls |
| **006** | Builder Manual & Sessão Avulsa | **partial** | `ExercisePicker.tsx`, `RoutineBuilder.tsx`, `montar/*`, `treinar/avulso/`, `programs.ts`, `program-types.ts`, `WorkoutPlayer.tsx`, `actions.ts` | **002+003** entregues; migrações aplicadas; envs; seed 005 (opcional p/ picker real); **decisão de produto** caminho A (base 003) vs. B (fatia avulsa hoje); teste e2e ao vivo |
| **007** | Onboarding & Anamnese | **partial** | `anamnese.ts`, `onboarding/page.tsx`, `onboarding/actions.ts`, `onboarding/anamnese/page.tsx`, `AnamneseWizard.tsx`, `schema.sql`, `db.ts`, `middleware.ts` | **002** (user_id) — senão schema single-user provisório; aplicar tabela `profiles`+RLS; destino do fork freestyle (006); **curadoria + disclaimer PAR-Q (revisão jurídica)**; redirect pós-cadastro; runner de teste; testes ao vivo 3 arquétipos |
| **008** | Templates & Geração IA | **human-gated** | `seeds/templates.ts`, `plan-schema.ts`, `plan-validator.ts`, `plan-generator.ts`, `programs.ts`, `onboarding/plano/page.tsx`, `ai.ts`, `actions.ts` | Migrações 003+007 aplicadas; **conteúdo 005 curado** (slugs do enum); `OPENAI_API_KEY`/`MODEL` (local+Vercel); 002 (user_id); testes e2e com OpenAI real + **revisão clínica** do plano; runner de teste (vitest) |
| **009** | Acompanhamento Adaptativo & Milestones | **partial** | `progression.ts`, `milestones.ts`, `schema.sql`, `coach.ts`, `db.ts`, `queries.ts`, `actions.ts`, `coach/page.tsx`, `CoachPanel.tsx` | Aplicar tabelas `milestones`/`plan_adjustments`; **003+004+008** (programs/skill_level/runtime); 002 (RLS); `OPENAI_API_KEY` (opcional); runner de teste; testes e2e com dados reais |
| **010** | Freemium & Stripe | **human-gated** | `entitlements.ts`, `stripe.ts`, `api/stripe/webhook/route.ts`, `billing/*`, `UpgradeCTA.tsx`, `migrations/010_subscriptions.sql`, `middleware.ts` | **DECISÃO ARQUITETURAL**: 002 primeiro vs. tier global provisório; conta Stripe + produtos/preços (PRICE_IDs); envs Stripe+`NEXT_PUBLIC_APP_URL`; registrar webhook + ativar Portal; aplicar migração; teste ao vivo com Stripe CLI; runner de teste; política de preço |

---

## 3. Portões humanos consolidados

Lista única de tudo que exige o usuário, **agrupada e na ordem em que será necessária**.

### A. Supabase — provisionamento (ANTES de 001)
1. Projeto Supabase ativo; copiar **URL** e **service_role key** para `.env.local`.
2. Aplicar `supabase/schema.sql` no **SQL Editor** (PostgREST não roda DDL).
3. **Rotacionar a service_role key** (foi exposta no chat) e entregar a nova ao agente — bloqueante de segurança.
4. Definir `APP_PASSWORD` e gerar `AUTH_SECRET` (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).

### B. Vercel — deploy (001)
5. Conta Vercel conectada ao repo.
6. Env vars Production: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_PASSWORD`, `AUTH_SECRET` (+ opcionais `OPENAI_*`).
7. Autorizar `git push` para `main` → redeploy.
8. Validar URL pública: login → registrar → histórico → coach, sem 500.

### C. Migração para contas (002)
9. **Backup do banco** antes de qualquer alteração de PK/backfill.
10. Aplicar `002_multitenant.sql` (user_id, RLS, PK composta de `settings`).
11. Criar conta-piloto (signup/dashboard) e fornecer o **uuid**.
12. Rodar `002_backfill_pilot.sql` com o uuid.
13. Trocar envs server-only por `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (local + Vercel); remover `APP_PASSWORD`/`AUTH_SECRET` pós-cutover.
14. Supabase Auth: política de **Confirm email** (desativar ou SMTP) + URLs de redirect.
15. Teste de isolamento com 2 contas.

### D. Modelo de dados + conteúdo (003 / 005)
16. Aplicar `003_program_model.sql` no SQL Editor.
17. `PILOT_USER_ID` (env) e rodar `scripts/seed-program.ts`; confirmar programa ativo.
18. `npm install` do runner TS (tsx + dotenv) para os seeds.
19. Rodar `npm run seed` (005) **2×** contra Supabase real — validar idempotência.
20. **Revisão e aprovação de segurança do conteúdo curado por um coach real** (≥40 exercícios + 5 escadas) — julgamento de domínio.
21. Curadoria de demo_urls (placeholder/null aceito em v1).

### E. Onboarding / IA / Loop (007 / 008 / 009)
22. Aplicar tabela `profiles` (+RLS).
23. **Redação/revisão jurídica do disclaimer PAR-Q** ("procure um profissional").
24. Curadoria final das perguntas de força/saúde da anamnese.
25. `OPENAI_API_KEY` (+ `OPENAI_MODEL`) local + Vercel — sem ela, 008 cai no fallback determinístico.
26. Aplicar tabelas `milestones` / `plan_adjustments` (009).
27. Testes e2e: anamnese → geração IA real → player → **revisão clínica** do plano (custo de API).

### F. Monetização (010)
28. **Decisão arquitetural**: 002 antes vs. tier global provisório.
29. Conta Stripe + produtos/preços mensal+anual → `PRICE_IDs`.
30. Envs: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `NEXT_PUBLIC_APP_URL` (local + Vercel).
31. Registrar endpoint de webhook (URL prod) + ativar **Customer Portal**.
32. Aplicar `010_subscriptions.sql`.
33. Teste ao vivo com **Stripe CLI** (`stripe listen`), cartões de teste, webhook duplicado + pagamento falho.
34. Definir política de preço (produto).

### G. Tooling transversal (uma vez, antes de 005)
35. Decidir e instalar **runner de testes** (vitest) + script `test` — não existe nenhum no `package.json`. Necessário para 008/009/010 terem cobertura real.

---

## 4. Fatia executável AGORA (sem ação humana)

Um agente pode codar imediatamente — **sem credenciais, sem Supabase, sem Stripe** — todo o conteúdo determinístico, SQL versionado, tipos e funções puras. Verificar com `next build` (e `next lint`) **entre cada bloco**.

### Ordem sugerida (cada passo termina com `next build` verde)

1. **001 — docs & schema (parcial)**
   - Editar `schema.sql`: adicionar `ALTER TABLE … ENABLE ROW LEVEL SECURITY` (sessions/entries/settings) + comentário RNF-002.
   - Corrigir `.env.example` (fonte da verdade dos nomes) e cabeçalho stale de `.env.local`.
   - Atualizar `README.md` (remover SQLite/postgres.js/DATABASE_URL → supabase-js/schema manual).
   - Escrever `_sbapitest.mjs` (execução fica para o humano).
   - → `next build`

2. **002 — SQL + clientes SSR + telas (sem aplicar/migrar)**
   - `migrations/002_multitenant.sql`, `002_backfill_pilot.sql` (SQL parametrizado).
   - `supabase-server.ts` / `supabase-browser.ts`; instalar `@supabase/ssr`.
   - Reescrever `login/page.tsx`, `auth-actions.ts`, `middleware.ts`; refatorar `db.ts`/`queries.ts`/`actions.ts` para cliente async por-request (cuidado com os ~18 pontos síncronos → todos `await`).
   - Ajustar `layout.tsx`/`Nav.tsx`/`configuracoes` (remover `getAuthConfig`).
   - → `next build` (verificação chave: nenhum `supa()` síncrono restante)

3. **003 — schema/tipos/CRUD/seed** (funções puras + SQL)
   - `migrations/003_program_model.sql` + comentários em `schema.sql`.
   - `program-types.ts`, `programs.ts` (CRUD), `seed-plan.ts` (`planToProgramRows` puro), `scripts/seed-program.ts`, `scripts/verify-seed.ts` (equivalência vs. PLAN, offline).
   - → `next build` + rodar `verify-seed` (offline)

4. **005 — conteúdo + seed script** (paralelizável com 004)
   - `seeds/types.ts`, `seeds/exercises.ts` (≥40), `seeds/skills.ts` (5 escadas), `seeds/README.md` + checklist de segurança, `scripts/seed.ts`, `scripts/tsconfig.json`, devDeps no `package.json`.
   - **Nota**: aprovação de segurança e execução ficam human-gated.
   - → `next build`

5. **004 — runtime** (paralelizável com 005)
   - `program-adapter.ts` (`adaptDay`/`adaptProgram`/`adaptLadders`, puro) + teste offline vs. PLAN.
   - `getActiveProgramView()` em `programs.ts`; migrar `treinar/*`, `page.tsx`, `plano/`, `progressao/`, `coach/*` para ler do banco; estender save com FKs; empty-state "sem programa ativo".
   - Grep final por imports de constantes de `@/lib/plan` no runtime.
   - → `next build`

6. **007 (parcial) — schema + lógica pura**
   - Tabela `profiles` no `schema.sql`; `anamnese.ts` (`SECTIONS`, `Question`, `validateProfile`, `evaluateParq`); `AnamneseWizard.tsx`; rotas `onboarding/*`; `upsertProfile`/`getProfile`.
   - → `next build`

7. **008 (parcial) — geração offline**
   - `seeds/templates.ts`, `plan-schema.ts` (`buildPlanSchema`), `plan-validator.ts` (`validatePlan`), `plan-generator.ts` (`buildFromTemplate` + `generatePlan` com fallback), `ai.ts::generatePlanWithAI`, `programs.ts::insertProgram`, `onboarding/plano/page.tsx`.
   - Testes de borda mockando OpenAI (T-010) — sem rede.
   - → `next build`

8. **009 (parcial) — milestones + regras**
   - Tabelas `milestones`/`plan_adjustments`; `milestones.ts` (`deriveMilestones`), `progression.ts` (`evaluateWeek`/`computeMilestoneStatus`/`isGoalComplete`), `buildAdjustments` em `coach.ts`; UI do coach. Testes puros offline.
   - → `next build`

9. **006 (fatia v1) + 010 (código)**
   - 006: `ExercisePicker` (derivado de PLAN), `RoutineBuilder` (estado local), refator do `WorkoutPlayer` para sessão avulsa sobre `sessions`/`entries` (roda hoje), pontos de entrada, fallback de label no histórico.
   - 010: `entitlements.ts` (+`entitlements.test.ts`), gate em `runAiCoach`, `stripe.ts`, `billing/*`, `api/stripe/webhook/route.ts` (runtime nodejs + isentar `/api/stripe` no middleware), `UpgradeCTA`, migração `010_subscriptions.sql`.
   - → `next build`

> **Regra de ouro da fatia**: nada que dependa de credenciais reais é "executado" — apenas escrito. O agente entrega código que **compila** (`next build`) e funções puras que **passam em testes offline**; a aplicação de migrações e os testes ao vivo ficam para os portões da §3.

---

## 5. Riscos transversais e mitigação

| # | Risco transversal | Onde aparece | Mitigação |
|---|-------------------|--------------|-----------|
| R1 | **Spec ≫ código real**: quase tudo assume Auth/RLS/programs que não existem | 003–010 | Sequenciar **002 e 003 como pré-condição dura**; para entregas isoladas, usar shim single-user explícito e documentar o retrabalho. |
| R2 | **service_role ignora RLS** → falsa sensação de segurança e potencial vazamento entre usuários | 002,003,007,009,010 | Garantir que pós-002 o runtime usa **anon key + sessão** (nunca service_role no cliente). Gating real **na camada de aplicação** (server actions/route handlers), não só no banco. **Rotacionar a chave exposta** (001/T-004). |
| R3 | **Migração de `supa()` síncrono → async por-request** (~18 pontos) pode deixar chamada síncrona e quebrar build | 002,003,004 | Refatorar tudo para `await db()`; checagem por grep + `next build` como portão. |
| R4 | **PK de `settings` `key` → `(user_id,key)`**: backfill antes da PK composta, `onConflict` atualizado | 002 | Ordem na migração: preencher user_id → criar PK composta → trocar `onConflict:'user_id,key'`. Backup obrigatório. |
| R5 | **Ausência de runner de teste** (sem jest/vitest) | 007,008,009,010 | Instalar **vitest** uma vez (portão §3-G). Manter coach/progression/validator **puros** (sem IO) para testabilidade. |
| R6 | **Segurança de conteúdo gerado** (escadas/templates/PAR-Q) sem revisão humana | 005,007,008 | **Não liberar a produção** sem aprovação de coach (005/T-003, 008) e revisão jurídica do disclaimer (007). Reusar limiares clínicos já existentes (`coach.ts`, `LOWER_BACK_FLAGS`). |
| R7 | **Acoplamento por nomes de exercício** (heurística lever `front`/`fl`/`planche`, `matchFront`/`matchPlanche`) | 004,005,008,009 | Padronizar **slugs** da biblioteca; o adaptador resolve nome→slug; validar que escadas/gráficos continuam casando após troca de fonte. |
| R8 | **Tipos de PK mistos** (serial em sessions/entries vs. uuid nas novas tabelas) | 003,004 | Colunas FK novas **nullable + `on delete set null`**; nunca alterar colunas existentes; histórico legado tolerante a null. |
| R9 | **Ciclo 007↔008** e rotas planejadas inexistentes (`/onboarding`, `/montar`) | 004,006,007,008 | Congelar contrato `profile` primeiro; empty-states/CTAs apontam para paths planejados com fallback textual até a rota existir. |
| R10 | **Webhook Stripe**: body cru + runtime nodejs + middleware redireciona | 010 | `export const runtime='nodejs'`; ler `req.text()` antes de qualquer parse; **isentar `/api/stripe` no matcher** do middleware; idempotência por `event.id` em tabela dedicada. |
| R11 | **Documentação stale** (README/`.env.local` falam de SQLite/pooler 6543) induz má config no Vercel | 001 | Corrigir antes do push (001/T-006); `.env.example` como fonte da verdade dos nomes. |
| R12 | **`sessions.date` é `text`** → filtros `gte('date', iso)` dependem de ISO `YYYY-MM-DD` | 001,004,009 | Cobrir no smoke test (001/T-001); manter formatação ISO consistente em todo insert. |

---

**Resumo de altitude**: comece pela coluna **001 → 002 → 003**, paralelize **004 ∥ 005**, trate **007+008** como fatia conjunta resolvendo o ciclo via contrato `profile`, e finalize com **009 → 010**. Um agente pode codar **toda a §4 hoje** sem tocar em credenciais; os 34 portões da §3 são o caminho humano que destrava cada execução ao vivo.
