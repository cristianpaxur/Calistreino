# Templates de Programa e Geração de Plano por IA

> **ID:** 008
> **Status:** 🔵 Em Andamento (código)
> **Prioridade:** 🟡 Média
> **Criada em:** 2026-06-22
> **Última atualização:** 2026-06-22
> **Autor:** Agente AI

---

## 1. Resumo Executivo

Transformar o `profile` (007) em um **programa personalizado**, com a IA atuando como
**configuradora de templates validados** (não geradora livre): ela escolhe o template do arquétipo,
encaixa os níveis/alavancas do exame físico, ajusta volume/frequência à disponibilidade, troca
exercícios por equipamento/lesão e define metas — com **saída estruturada** e uma **camada de sanidade**.

## 2. Contexto e Motivação

### 2.1 Problema Atual
Existe perfil (007) e backbone (005), mas nada que vire um plano concreto e seguro automaticamente.

### 2.2 Impacto do Problema
É a diferenciação central (coach que monta o plano). Sem isto, só há freestyle.

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| IA configura templates validados (structured output) | Seguro, consistente, barato, auditável | Precisa de templates curados | ✅ Escolhida |
| IA gera plano livre (texto) | Flexível | Inseguro, caro, alucina | ❌ Descartada |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura
`profile` + templates (por arquétipo/skill) → prompt → IA (OpenAI, **structured outputs** no schema do
programa 003) → **validador** (tetos de volume, descanso mínimo, frequência, coerência com equipamento/lesão)
→ persiste como `program` (source=ai) ativo.

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `supabase/seeds/templates.ts` | Arquivo | Criar | Templates por arquétipo/skill |
| `src/lib/plan-generator.ts` | Arquivo | Criar | Orquestra IA + validação |
| `src/lib/plan-schema.ts` | Arquivo | Criar | JSON Schema do plano (structured output) |
| `src/lib/plan-validator.ts` | Arquivo | Criar | Camada de sanidade |
| `src/app/actions.ts` | Arquivo | Modificar | Ação "gerar plano" |

### 3.3 Interfaces e Contratos
#### Entradas
`profile` (007) + templates (curados).
#### Saídas
`program` estruturado válido, salvo e ativo.
#### Contratos de API
OpenAI Chat Completions com `response_format`/structured outputs validando o schema do plano.

### 3.4 Modelos de Dados
Saída mapeada para `programs`/`program_days`/`day_exercises` (003); exercícios só por `exercise_id`
da biblioteca (005). Registrar `templateId`, `model`, `inputProfileHash` para auditoria.

### 3.5 Fluxo de Execução
1. Selecionar template do arquétipo/skill.
2. Montar prompt com perfil + template + restrições (equipamento, lesões, dias).
3. IA devolve plano estruturado.
4. Validador checa/ajusta; se inválido, regenera com feedback (1–2 tentativas) ou cai no template base.
5. Persistir como programa ativo + metas iniciais (entregues à 009).

### 3.6 Tratamento de Erros
Falha/saída inválida → retry com correção; após N falhas, aplica o template base parametrizado (fallback determinístico). Sem `OPENAI_API_KEY` → usa só o template base.

## 4. Requisitos

### 4.1 Requisitos Funcionais
- **RF-001:** Selecionar template por arquétipo/skill.
- **RF-002:** Gerar plano via IA em saída estruturada (schema do programa).
- **RF-003:** Validar (tetos de volume, descanso, frequência, equipamento, lesão).
- **RF-004:** Persistir como programa ativo + metas.
- **RF-005:** Fallback determinístico sem IA / em falha.

### 4.2 Requisitos Não-Funcionais
- **RNF-001:** Exercícios apenas da biblioteca curada (sem invenção).
- **RNF-002:** Custo controlado (1 chamada típica; cache por hash de perfil).

### 4.3 Restrições e Limitações
v1 com 3–5 templates (poucos skills + geral).

## 5. Critérios de Aceitação
- [~] **CA-001:** Perfil → plano estruturado válido e salvo como ativo. *(código: `generateProgramFromProfile` + `gerarPlano` persistem como ativo; validade coberta offline. Persistência ao vivo = portão humano: migração 008 + sessão real.)*
- [x] **CA-002:** Validador rejeita planos fora dos limites e corrige/fallback. *(`validatePlan` + loop `generatePlan`; coberto em `verify:plan`.)*
- [x] **CA-003:** Plano respeita equipamento e lesões do perfil. *(poda por equipamento/PAR-Q; bordas verdes em `verify:plan`.)*
- [x] **CA-004:** Sem IA, o template base gera um plano coerente. *(`buildFromTemplate`; 3 perfis verdes.)*
- [~] **CA-005:** Plano gerado roda no player (004) sem ajustes. *(o draft mapeia 1:1 para `programs/program_days/day_exercises` que o runtime 004 já consome; verificação ao vivo no player = portão humano.)*

> **Status do código:** fatia automatável da §4 do roadmap entregue; `npm run build` verde e `npm run verify:plan` verde (offline, IA mockada). Pendências = portões humanos (ver tasks.md): aplicar migração 008, semear 005, `OPENAI_API_KEY`, teste e2e + revisão clínica.

## 6. Plano de Testes
### 6.1 Testes Unitários
Validador (limites/coerência); mapeamento saída→programa.
### 6.2 Testes de Integração
3 perfis (skill/força/saúde) → planos válidos e executáveis.
### 6.3 Testes de Aceitação
Revisão de um plano gerado por critérios de segurança.
### 6.4 Casos de Borda
Lesão grave (poda exercícios); sem equipamento; disponibilidade mínima (2 dias); saída malformada da IA.

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| IA gera volume/escolha perigosa | Média | Alto | Structured output + validador + só biblioteca |
| Custo de IA por usuário | Média | Médio | 1 chamada + cache; IA atrás do paywall (010) |
| Templates insuficientes | Alta | Médio | Começar com poucos; expandir conteúdo (005) |

## 8. Dependências
### 8.1 Internas
007 (perfil), 005 (biblioteca/escadas), 003 (modelo), 004 (executar o plano).
### 8.2 Externas
OpenAI API (já no projeto).

## 9. Observações e Decisões de Design
Decisão central do produto: **IA configura, não inventa.** O validador é a rede de segurança que
torna a IA confiável o suficiente para um produto público. Auditar entradas/saídas (template, modelo,
hash) para rastreabilidade.
