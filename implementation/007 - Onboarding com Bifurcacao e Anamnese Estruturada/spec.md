# Onboarding com Bifurcação e Anamnese Estruturada

> **ID:** 007
> **Status:** 🔵 Em Andamento (código)
> **Prioridade:** 🟠 Alta
> **Criada em:** 2026-06-22
> **Última atualização:** 2026-06-22
> **Autor:** Agente AI

---

## 1. Resumo Executivo

Criar a porta de entrada do produto: uma **bifurcação reversível** (via guiada × via freestyle) e,
na via guiada, uma **anamnese estruturada** (estilo ficha clínica) que coleta objetivo/arquétipo,
perfil, exame físico (testes-benchmark), triagem de saúde (PAR-Q), logística e preferências,
produzindo um **perfil estruturado** que alimenta a geração do plano (008).

## 2. Contexto e Motivação

### 2.1 Problema Atual
Não há triagem nem segmentação. Todo usuário cai no mesmo lugar; não há dado para personalizar.

### 2.2 Impacto do Problema
Sem anamnese, a IA (008) não tem insumo e o produto não diferencia o iniciante do caçador de skill.

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| Anamnese curta multi-etapa + fork | Personaliza; segura (PAR-Q); boa conversão | Esforço de UX | ✅ Escolhida |
| Onboarding longo único | Mais dado | Mata conversão | ❌ Descartada |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura
Pós-cadastro (002) → tela de fork. Freestyle → 006. Guiada → wizard de anamnese (ramificado por
arquétipo) → grava `profiles`. A anamnese fica acessível depois (em Ajustes / "quero um plano").

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `supabase/schema.sql` | Arquivo | Modificar | Tabela `profiles` |
| `src/app/onboarding/*` | Arquivo | Criar | Fork + wizard |
| `src/components/AnamneseWizard.tsx` | Arquivo | Criar | Etapas ramificadas |
| `src/lib/anamnese.ts` | Arquivo | Criar | Schema do perfil + perguntas |

### 3.3 Interfaces e Contratos
#### Entradas
Respostas do usuário por seção.
#### Saídas
`profile` (JSON estruturado) + escolha de via.
#### Contratos de API
Consumido por 008 (geração de plano).

### 3.4 Modelos de Dados
`profiles(user_id, archetype, goal_skill, age, sex, bodyweight, height, training_age,
benchmarks jsonb, health_flags jsonb, days_per_week, session_minutes, equipment[], preferences jsonb, updated_at)`.

### 3.5 Fluxo de Execução
1. Fork: "me monta o plano" × "já treino / só registrar".
2. Guiada: Objetivo/arquétipo → (se skill) qual skill → perfil → exame físico → PAR-Q → logística → preferências.
3. Salva `profile`; encaminha para 008.

### 3.6 Tratamento de Erros
Validações por etapa; defaults; possibilidade de pular itens não-críticos. PAR-Q com flag de "procure profissional".

## 4. Requisitos

### 4.1 Requisitos Funcionais
- **RF-001:** Fork reversível guiado × freestyle.
- **RF-002:** Wizard ramificado por arquétipo (skill/força/saúde).
- **RF-003:** Coletar benchmarks objetivos por padrão de movimento.
- **RF-004:** Triagem de saúde (PAR-Q) com bloqueios/avisos.
- **RF-005:** Persistir `profile` estruturado; reabrir/editar depois.

### 4.2 Requisitos Não-Funcionais
- **RNF-001:** ≤ ~14 perguntas no caminho típico (conversão).
- **RNF-002:** Acessível/responsivo (identidade visual atual).

### 4.3 Restrições e Limitações
v1 com benchmarks auto-reportados (sem vídeo-análise).

## 5. Critérios de Aceitação
- [ ] **CA-001:** Usuário escolhe via; freestyle pula a anamnese.
- [ ] **CA-002:** Anamnese ramifica por arquétipo e grava `profile`.
- [ ] **CA-003:** PAR-Q dispara avisos/bloqueios apropriados.
- [ ] **CA-004:** Perfil reabre/edita; anamnese acessível mesmo para quem entrou freestyle.

## 6. Plano de Testes
### 6.1 Testes Unitários
Validação do schema do perfil; lógica de ramificação.
### 6.2 Testes de Integração
Percurso completo guiado → `profile` salvo.
### 6.3 Testes de Aceitação
Os 3 arquétipos geram perfis coerentes.
### 6.4 Casos de Borda
PAR-Q positivo (lesão grave); usuário sem equipamento; pular itens.

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Anamnese longa derruba conversão | Média | Alto | Curta, progressiva, com defaults |
| Benchmark auto-reportado impreciso | Alta | Médio | Semana 1 conservadora se auto-calibra (009) |
| Responsabilidade legal (saúde) | Média | Alto | PAR-Q + disclaimers + "procure profissional" |

## 8. Dependências
### 8.1 Internas
002 (contas), 006 (destino do fork freestyle).
### 8.2 Externas
Nenhuma.

## 9. Observações e Decisões de Design
O **exame físico (benchmarks)** é o dado mais valioso — define a alavanca/nível inicial e a segurança
do plano. A anamnese é o moat (porta de entrada que personaliza); manter curta e reversível.
