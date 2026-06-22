# Biblioteca de Exercícios e Escadas de Progressão

> **ID:** 005
> **Status:** 🔵 Em Andamento (código)
> **Prioridade:** 🟠 Alta
> **Criada em:** 2026-06-22
> **Última atualização:** 2026-06-22
> **Autor:** Agente AI

---

## 1. Resumo Executivo

Popular e validar o **conteúdo curado** do produto: uma biblioteca de exercícios (com categoria,
padrão de movimento, equipamento, cues e demo) e as escadas de progressão dos principais skills
(front lever, planche, parada de mão, muscle-up, pistol, bandeira, back lever). É o backbone que a
IA configura (008) e o usuário usa no builder (006).

## 2. Contexto e Motivação

### 2.1 Problema Atual
Existem só os exercícios do plano FL+Planche, embutidos. Não há catálogo nem escadas formalizadas
para outros objetivos.

### 2.2 Impacto do Problema
Sem catálogo, nem a IA nem o construtor manual têm de onde escolher; a personalização fica pobre e
insegura (sem cues/regressões).

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| Seed validado por coach (curado) | Seguro, consistente, barato | Esforço de conteúdo | ✅ Escolhida |
| Gerar exercícios via IA on-demand | Sem curadoria | Risco de exercício perigoso/inventado | ❌ Descartada |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura
Dados inseridos em `exercise_library`, `skills`, `skill_levels` (003) via seed versionado. Cada exercício
mapeia para uma posição em uma ou mais escadas (progressão/regressão).

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `supabase/seeds/exercises.ts` | Arquivo | Criar | Catálogo de exercícios |
| `supabase/seeds/skills.ts` | Arquivo | Criar | Skills + escadas |
| `scripts/seed.ts` | Arquivo | Criar | Aplica seeds (idempotente) |

### 3.3 Interfaces e Contratos
#### Entradas
Dados de conteúdo (curados).
#### Saídas
Biblioteca e escadas populadas e consultáveis.
#### Contratos de API
N/A.

### 3.4 Modelos de Dados
Usa `exercise_library`, `skills`, `skill_levels` (003). Cada `skill_level` referencia exercícios-chave.

### 3.5 Fluxo de Execução
1. Definir catálogo inicial (push/pull/pernas/core + isométricos) com metadados e cues.
2. Definir escadas dos skills prioritários.
3. Rodar seed idempotente; validar.

### 3.6 Tratamento de Erros
Seed idempotente (upsert por `slug`); reexecução não duplica.

## 4. Requisitos

### 4.1 Requisitos Funcionais
- **RF-001:** Catálogo com ≥ 40 exercícios cobrindo padrões básicos + isométricos.
- **RF-002:** Escadas para ≥ 5 skills (FL, Planche, Handstand, Muscle-up, Pistol).
- **RF-003:** Cada exercício com categoria, padrão, equipamento, unidade-alvo e cue.
- **RF-004:** Seed idempotente.

### 4.2 Requisitos Não-Funcionais
- **RNF-001:** Conteúdo revisado quanto a segurança (regressões/prehab).
- **RNF-002:** `demo_url` opcional para vídeo/GIF futuro.

### 4.3 Restrições e Limitações
v1 sem upload de mídia (apenas URLs/placeholder).

## 5. Critérios de Aceitação
- [~] **CA-001:** Biblioteca e escadas populadas no Supabase. _(conteúdo + seed escritos; aplicação ao vivo é portão humano)_
- [~] **CA-002:** Seed roda 2× sem duplicar. _(seed idempotente por slug implementado; validação ao vivo é portão humano)_
- [x] **CA-003:** Cada skill tem escada ordenada (regressão→meta). _(garantido por `verify:content`)_
- [x] **CA-004:** Exercícios filtráveis por equipamento e padrão. _(metadados `equipment[]`/`pattern` + filtro validado offline)_

## 6. Plano de Testes
### 6.1 Testes Unitários
Validação do formato do seed (campos obrigatórios).
### 6.2 Testes de Integração
Consultar biblioteca por filtro; ler uma escada completa.
### 6.3 Testes de Aceitação
Revisão do conteúdo por checklist de segurança.
### 6.4 Casos de Borda
Exercício em múltiplas escadas; skill com muitos níveis.

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Conteúdo impreciso/perigoso | Média | Alto | Revisão por coach de calistenia |
| Esforço de conteúdo subestimado | Alta | Médio | Começar com 5 skills + básicos; expandir depois |

## 8. Dependências
### 8.1 Internas
003 (tabelas).
### 8.2 Externas
Curadoria/validação por especialista (idealmente coach real).

## 9. Observações e Decisões de Design
Este é tanto trabalho de **conteúdo** quanto de código — e é o que sustenta a segurança do produto
(a IA só escolhe daqui, não inventa). Tratar a curadoria como item de produto, não só técnico.
