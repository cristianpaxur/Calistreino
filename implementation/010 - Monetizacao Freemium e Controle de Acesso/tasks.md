# Tarefas: Monetização Freemium e Controle de Acesso

> **Implementação:** 010 - Monetização Freemium e Controle de Acesso
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 6/8 tarefas de código concluídas; T-008 é portão humano (teste ao vivo Stripe)
> **Última atualização:** 2026-06-22

---

## Legenda
- `[ ]` Pendente · `[x]` Concluída · `[!]` Bloqueada · `[-]` Cancelada

---

## Tarefas

### Fase 1: Modelo e gating

- [x] **T-001:** Tabela `subscriptions` + RLS *(SQL escrito; aplicação = portão humano)*
  - **Descrição:** Tier (free/pro), status e IDs do Stripe por usuário.
  - **Arquivos envolvidos:** `supabase/migrations/010_subscriptions.sql` (`subscriptions` + `stripe_events` p/ idempotência)
  - **Critério de conclusão:** Tabela + políticas escritas (RLS read-own; escrita só via service_role no webhook).
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena
  - **Portão humano:** rodar o SQL no Supabase SQL Editor (depois da 002).

- [x] **T-002:** Camada de entitlements
  - **Descrição:** `canUse(feature, ent)` puro mapeando features pagas × tier; default free; `effectiveTier` derruba pro sem status ativo (CA-004).
  - **Arquivos envolvidos:** `src/lib/entitlements.ts` (puro) + `src/lib/billing.ts` (IO: `getEntitlement`/`getTier`/`requireFeature`)
  - **Critério de conclusão:** Decisão central de acesso. Coberto por `scripts/verify-entitlements.ts` (offline).
  - **Dependências:** T-001
  - **Estimativa:** Pequena

- [x] **T-003:** Aplicar gate nas ações pagas
  - **Descrição:** `requireFeature` server-side antes de gerar plano por IA (008) e análise por IA do coach (009). Bloqueio devolve sinal `upgrade`.
  - **Arquivos envolvidos:** `src/app/actions.ts` (`runAiCoach`), `src/app/onboarding/actions.ts` (`gerarPlano`)
  - **Critério de conclusão:** Features pagas exigem pro (não burlável pelo client — RNF-001).
  - **Dependências:** T-002
  - **Estimativa:** Média

### Fase 2: Pagamento

- [x] **T-004:** Integração Stripe (checkout) *(código escrito; chaves/pacote = portão humano)*
  - **Descrição:** Server action `startCheckout(plan)` (mensal/anual) cria/reusa customer + sessão de checkout; página de billing.
  - **Arquivos envolvidos:** `src/app/billing/page.tsx`, `src/components/BillingPanel.tsx`, `src/app/actions.ts`, `src/lib/stripe.ts` (wrapper lazy), `src/lib/billing-io.ts`
  - **Critério de conclusão:** Fluxo de checkout codado; degrada com mensagem legível sem Stripe.
  - **Dependências:** T-001
  - **Estimativa:** Média
  - **Portão humano:** `npm i stripe`; criar produtos/preços → `STRIPE_PRICE_*`; `STRIPE_SECRET_KEY`; `NEXT_PUBLIC_APP_URL`.

- [x] **T-005:** Webhook do Stripe *(código escrito; registro/teste ao vivo = portão humano)*
  - **Descrição:** Endpoint `runtime=nodejs` que lê corpo cru, verifica assinatura, é idempotente por `event.id` (tabela `stripe_events`) e atualiza `subscriptions` via service_role. Mapeamento evento→tier é puro (`stripe-events.ts`, testado offline). `/api/stripe` isento no middleware (R10).
  - **Arquivos envolvidos:** `src/app/api/stripe/webhook/route.ts`, `src/lib/stripe-events.ts`, `src/lib/billing-io.ts`, `src/lib/supabase-admin.ts`, `src/middleware.ts`
  - **Critério de conclusão:** Tier atualiza com os eventos (lógica coberta por verify offline).
  - **Dependências:** T-004
  - **Estimativa:** Média
  - **Portão humano:** registrar endpoint + `STRIPE_WEBHOOK_SECRET`; `SUPABASE_SERVICE_ROLE_KEY` em prod.

- [x] **T-006:** Portal de assinatura
  - **Descrição:** Server action `openBillingPortal()` abre o Customer Portal do Stripe (gerenciar/cancelar).
  - **Arquivos envolvidos:** `src/app/actions.ts`, `src/components/BillingPanel.tsx`
  - **Critério de conclusão:** Gerenciar/cancelar codado; degrada sem Stripe.
  - **Dependências:** T-004
  - **Estimativa:** Pequena
  - **Portão humano:** ativar o Customer Portal no painel do Stripe.

### Fase 3: UX e validação

- [x] **T-007:** CTAs de upgrade
  - **Descrição:** `UpgradeCTA` reutilizável + estado do tier; CoachPanel mostra CTA quando não-Pro; PlanGenerator trata sinal `upgrade`; card de assinatura (badge FREE/PRO) em configurações.
  - **Arquivos envolvidos:** `src/components/UpgradeCTA.tsx`, `src/components/CoachPanel.tsx`, `src/components/PlanGenerator.tsx`, `src/app/coach/page.tsx`, `src/app/configuracoes/page.tsx`
  - **Critério de conclusão:** Upgrade acessível onde faz sentido (client só reflete o estado; gate é server-side).
  - **Dependências:** T-003
  - **Estimativa:** Pequena

- [!] **T-008:** Teste do fluxo de billing (modo teste) — **PORTÃO HUMANO**
  - **Descrição:** free → upgrade → pro → recursos liberados → cancelar → volta a free; webhook duplicado e pagamento falho.
  - **Arquivos envolvidos:** — (offline coberto por `scripts/verify-entitlements.ts`)
  - **Critério de conclusão:** Fluxo e bordas validados AO VIVO (Stripe CLI `stripe listen` + cartões de teste).
  - **Dependências:** T-005, T-007
  - **Estimativa:** Média
  - **Portão humano:** depende de conta Stripe + envs + migração aplicada (não automatável). Lógica pura já validada offline.

---

## Registro de Progresso

| Tarefa | Status | Data | Observações |
|--------|--------|------|-------------|
| T-001 | ✅ Código | 2026-06-22 | `010_subscriptions.sql` (+`stripe_events`). Aplicação = portão humano. |
| T-002 | ✅ Código | 2026-06-22 | `entitlements.ts` (puro) + `billing.ts` (IO). Verify offline verde. |
| T-003 | ✅ Código | 2026-06-22 | Gate server-side em `runAiCoach` e `gerarPlano`. |
| T-004 | ✅ Código | 2026-06-22 | `startCheckout` + billing page. `getOrCreateCustomerId` grava o `stripe_customer_id` via service_role (RNF-001: sem policy de write p/ usuário). `npm i stripe` + envs = portão humano. |
| T-005 | ✅ Código | 2026-06-22 | Webhook nodejs idempotente; mapper puro testado offline. |
| T-006 | ✅ Código | 2026-06-22 | `openBillingPortal` (Customer Portal). |
| T-007 | ✅ Código | 2026-06-22 | `UpgradeCTA` + estado de tier no coach/plano/configurações. |
| T-008 | 🚧 Portão humano | 2026-06-22 | Lógica validada offline; teste ao vivo exige Stripe CLI + envs. |
