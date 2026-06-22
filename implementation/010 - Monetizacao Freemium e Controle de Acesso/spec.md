# Monetização Freemium e Controle de Acesso

> **ID:** 010
> **Status:** 🔵 Em Andamento (código)
> **Prioridade:** 🟢 Baixa
> **Criada em:** 2026-06-22
> **Última atualização:** 2026-06-22
> **Autor:** Agente AI

---

## 1. Resumo Executivo

Ligar o modelo **freemium**: definir o que é grátis (logger freestyle, rotinas próprias, timers, voz,
coach por regras) e o que é pago (anamnese + plano por IA, análise por IA, analytics avançado),
com controle de acesso por plano de assinatura e integração de pagamento.

## 2. Contexto e Motivação

### 2.1 Problema Atual
Todas as features estão abertas. Não há receita nem distinção de tiers.

### 2.2 Impacto do Problema
Sem monetização, o produto não se sustenta; sem gating, não há conversão do funil grátis → pago.

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| Freemium com Stripe + gating server-side | Padrão, recorrência, simples de gatear | Integração de billing | ✅ Escolhida |
| Pago único / sem free | Menos funil | Reduz aquisição (perde a cunha grátis) | ❌ Descartada |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura
`subscriptions` por usuário (tier free|pro, status). Checkout via Stripe; webhook atualiza o tier.
Gating central (`entitlements`) consultado no servidor antes de features pagas (geração por IA,
análise por IA, analytics). UI mostra estado e CTA de upgrade.

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `supabase/schema.sql` | Arquivo | Modificar | `subscriptions` |
| `src/lib/entitlements.ts` | Arquivo | Criar | `canUse(feature, user)` |
| `src/app/api/stripe/webhook/route.ts` | Arquivo | Criar | Atualiza tier |
| `src/app/billing/*` | Arquivo | Criar | Checkout/portal |
| `src/app/actions.ts` | Arquivo | Modificar | Gate em ações pagas |
| Telas (coach, onboarding) | Arquivo | Modificar | CTA upgrade |

### 3.3 Interfaces e Contratos
#### Entradas
Eventos de assinatura (Stripe), tier do usuário.
#### Saídas
Acesso liberado/bloqueado; status de assinatura.
#### Contratos de API
Stripe Checkout/Billing Portal + webhook (assinatura verificada).

### 3.4 Modelos de Dados
`subscriptions(user_id, tier, status, stripe_customer_id, stripe_subscription_id, current_period_end)`.

### 3.5 Fluxo de Execução
1. Free usa logger/rotinas/timers/voz/coach-regras.
2. Ao acionar feature paga sem tier → CTA → Checkout Stripe.
3. Webhook confirma → tier pro → libera.
4. Portal para gerenciar/cancelar.

### 3.6 Tratamento de Erros
Webhook idempotente + verificação de assinatura. Pagamento falho → mantém free. Acesso pago sem tier → bloqueio gracioso com CTA.

## 4. Requisitos

### 4.1 Requisitos Funcionais
- **RF-001:** Tiers free/pro por usuário.
- **RF-002:** Gating server-side de features pagas (IA de plano/análise, analytics).
- **RF-003:** Checkout e portal de assinatura (Stripe).
- **RF-004:** Webhook atualiza tier de forma confiável.

### 4.2 Requisitos Não-Funcionais
- **RNF-001:** Gating no servidor (não burlável pelo client).
- **RNF-002:** Webhook idempotente e verificado.

### 4.3 Restrições e Limitações
v1: 2 tiers (free/pro) e 1 plano pago (mensal/anual).

## 5. Critérios de Aceitação
- [ ] **CA-001:** Free acessa logger/rotinas/timers/voz/coach-regras.
- [ ] **CA-002:** Features de IA/analytics exigem pro (bloqueio + CTA).
- [ ] **CA-003:** Checkout assina e libera pro via webhook.
- [ ] **CA-004:** Cancelamento volta a free no fim do período.

## 6. Plano de Testes
### 6.1 Testes Unitários
`canUse` por feature/tier.
### 6.2 Testes de Integração
Webhook (modo teste) → tier atualizado → acesso liberado.
### 6.3 Testes de Aceitação
Fluxo free→upgrade→pro→cancelar.
### 6.4 Casos de Borda
Webhook duplicado; pagamento falho; tentativa de burlar gate pelo client.

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Gate burlável | Média | Alto | Sempre validar no servidor |
| Webhook inconsistente | Média | Médio | Idempotência + verificação de assinatura |
| Precificação errada | Média | Médio | Começar simples; iterar com dados |

## 8. Dependências
### 8.1 Internas
002 (contas), 008 (IA de plano), 009 (acompanhamento/analytics).
### 8.2 Externas
Stripe (conta + chaves).

## 9. Observações e Decisões de Design
A **voz e o logger ficam grátis** de propósito — são a isca/cunha de mercado e o funil. O pago é a
diferenciação (IA + acompanhamento). Gating sempre no servidor; o client só reflete o estado.
