# Acompanhamento Adaptativo, Milestones e Loop de Objetivo

> **ID:** 009
> **Status:** 🔵 Em Andamento (código)
> **Prioridade:** 🟡 Média
> **Criada em:** 2026-06-22
> **Última atualização:** 2026-06-22
> **Autor:** Agente AI

---

## 1. Resumo Executivo

Fazer o plano **acompanhar o usuário do começo ao fim**: definir milestones por objetivo, reavaliar
semanalmente com o coach (motor de regras + IA) ajustando o plano (subir alavanca / manter / deload),
reanalisar ao fim de cada ciclo e, ao bater a meta, fechar o loop oferecendo o próximo objetivo
(retenção). Estende o coach que já existe.

## 2. Contexto e Motivação

### 2.1 Problema Atual
O coach atual dá um veredito pontual; o plano não evolui sozinho nem tem metas/checkpoints explícitos.

### 2.2 Impacto do Problema
"Do começo ao fim" é a promessa do produto guiado. Sem isto, o plano gerado (008) vira estático.

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| Motor de regras + IA reavaliando por período, sobre milestones | Confiável (regras) + nuance (IA); barato | Lógica de ajuste a construir | ✅ Escolhida |
| Só IA reavaliando | Flexível | Caro/imprevisível | ❌ Descartada |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura
`milestones` por programa/objetivo. Um avaliador semanal lê as `entries` recentes, aplica as regras
(avançar/segurar/deload — já existentes em `coach.ts`) e propõe ajustes ao `program` (ex.: subir o
`skill_level`, alterar volume/RIR). IA opcional dá leitura/explicação. Ao concluir milestones/objetivo,
dispara o loop de novo objetivo (volta à 007/008).

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `supabase/schema.sql` | Arquivo | Modificar | `milestones`, `plan_adjustments` |
| `src/lib/coach.ts` | Arquivo | Estender | Regras de ajuste do plano |
| `src/lib/progression.ts` | Arquivo | Criar | Avaliação semanal/ciclo + propostas |
| `src/app/coach/page.tsx` | Arquivo | Modificar | Mostrar milestones + ajustes sugeridos |
| `src/app/actions.ts` | Arquivo | Modificar | Aplicar ajuste; concluir objetivo |

### 3.3 Interfaces e Contratos
#### Entradas
Histórico de `entries`, programa ativo, milestones, perfil.
#### Saídas
Ajustes de plano (aplicáveis), status de milestones, próximo objetivo.
#### Contratos de API
IA opcional (explicação); regras determinísticas locais.

### 3.4 Modelos de Dados
`milestones(id, program_id, skill_id null, description, target_unit, target_value, due_week, status)`;
`plan_adjustments(id, program_id, week, kind[advance|hold|deload|volume], detail jsonb, applied, created_at)`.

### 3.5 Fluxo de Execução
1. Ao gerar/criar o plano, derivar milestones.
2. Semanalmente (ou ao abrir o coach), avaliar dados → propor ajuste.
3. Usuário aceita/ignora; aplicar muda o `program`.
4. Ao bater milestones/objetivo → comemorar + oferecer próximo objetivo (007/008).

### 3.6 Tratamento de Erros
Dados insuficientes → manter conservador. Regra ambígua → não auto-aplica; sugere.

## 4. Requisitos

### 4.1 Requisitos Funcionais
- **RF-001:** Milestones por objetivo, com status atualizado pelos dados.
- **RF-002:** Avaliação periódica que propõe ajuste (subir/manter/deload/volume).
- **RF-003:** Aplicar ajuste altera o programa ativo.
- **RF-004:** Loop de conclusão: comemorar + próximo objetivo.
- **RF-005:** IA opcional explica a recomendação.

### 4.2 Requisitos Não-Funcionais
- **RNF-001:** Regras determinísticas como base (sem depender de IA).
- **RNF-002:** Ajustes auditáveis (`plan_adjustments`).

### 4.3 Restrições e Limitações
v1 reavalia ao abrir o coach (sem cron); cron pode vir depois.

## 5. Critérios de Aceitação
- [ ] **CA-001:** Milestones criados com o plano e atualizados pelos dados.
- [ ] **CA-002:** Avaliação propõe ajuste coerente com as regras.
- [ ] **CA-003:** Aplicar ajuste muda o programa (ex.: sobe alavanca).
- [ ] **CA-004:** Concluir objetivo dispara o loop de novo objetivo.

## 6. Plano de Testes
### 6.1 Testes Unitários
Regras de avanço/deload; status de milestone.
### 6.2 Testes de Integração
Histórico simulado → ajuste proposto → aplicado → programa muda.
### 6.3 Testes de Aceitação
Bater um milestone dispara comemoração + próximo objetivo.
### 6.4 Casos de Borda
Cotovelo ≥3 em 2 sessões (deload); regressão (queda de tempo); dados escassos.

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Ajuste automático inadequado | Média | Alto | Sugerir (não auto-aplicar) + regras conservadoras |
| Complexidade da lógica | Média | Médio | Reusar `coach.ts`; começar com poucos tipos de ajuste |

## 8. Dependências
### 8.1 Internas
008 (plano + metas), 004 (runtime/dados), coach existente.
### 8.2 Externas
OpenAI (opcional).

## 9. Observações e Decisões de Design
Mantém a filosofia "decida por dados": regras determinísticas dirigem; IA explica/enriquece. O loop de
objetivo é o motor de **retenção** — fim de uma meta é começo da próxima.
