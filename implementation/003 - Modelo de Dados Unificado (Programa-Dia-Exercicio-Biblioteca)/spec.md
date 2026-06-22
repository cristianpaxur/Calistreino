# Modelo de Dados Unificado (Programa, Dia, Exercício, Biblioteca)

> **ID:** 003
> **Status:** 🔵 Em Andamento (código)
> **Prioridade:** 🔴 Crítica
> **Criada em:** 2026-06-22
> **Última atualização:** 2026-06-22
> **Autor:** Agente AI

---

## 1. Resumo Executivo

Transformar o plano de treino — hoje uma constante hardcoded (`src/lib/plan.ts`) — em **dado por
usuário**, com um modelo unificado de Programa → Dia → Exercício, apoiado por uma Biblioteca de
exercícios e Escadas de skill. É a peça que destrava tanto a geração por IA quanto o construtor manual.

## 2. Contexto e Motivação

### 2.1 Problema Atual
O plano (5 dias FL+Planche) está em código. Todo usuário veria o mesmo plano; ninguém pode ter o seu.

### 2.2 Impacto do Problema
Sem plano-como-dado não há onboarding (IA ou manual), nem personalização — é o gargalo do produto.

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| Modelo relacional Programa/Dia/Exercício | Flexível; serve IA e manual; consultável | Migração de dados | ✅ Escolhida |
| Plano como JSON único por usuário | Simples | Difícil consultar/agregar; pouca estrutura | ❌ Descartada |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura
Novas tabelas: `exercise_library`, `skills`, `skill_levels` (escada), `programs`, `program_days`,
`day_exercises`. `entries` (log) passa a referenciar opcionalmente `day_exercise_id`/`exercise_id`.
A constante `PLAN` vira um **seed** que popula um programa-modelo.

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `supabase/schema.sql` | Arquivo | Modificar | Novas tabelas + RLS |
| `src/lib/plan.ts` | Arquivo | Refatorar | Vira seed/migração, não fonte runtime |
| `src/lib/db.ts`, `queries.ts` | Arquivo | Modificar | CRUD de programa/dia/exercício |
| `src/lib/program-types.ts` | Arquivo | Criar | Tipos do domínio de plano |

### 3.3 Interfaces e Contratos
#### Entradas
Definições de programa (dias, exercícios, prescrições) — vindas do seed, da IA (008) ou do builder (006).
#### Saídas
Programa ativo do usuário, consultável por dia.
#### Contratos de API
N/A (interno via supabase-js).

### 3.4 Modelos de Dados
- `exercise_library(id, slug, name, category, pattern, is_skill, default_unit[reps|seconds], equipment[], cues, demo_url, owner_user_id null=global)`
- `skills(id, slug, name)` · `skill_levels(id, skill_id, position, name)` (a escada: tuck→…→full)
- `programs(id, user_id, name, archetype, source[seed|ai|manual], cycle_weeks, active, created_at)`
- `program_days(id, program_id, code, weekday, title, focus, character, position)`
- `day_exercises(id, program_day_id, exercise_id|exercise_name, is_skill, prescription, target_unit, target_min, target_max, rest_seconds, position, note)`
- `entries` (existente): add `program_day_id`/`day_exercise_id` nullable.

### 3.5 Fluxo de Execução
1. Migração cria as tabelas e popula a biblioteca/escadas básicas e um programa-modelo a partir de `PLAN`.
2. Usuário-piloto recebe esse programa como ativo.
3. Runtime (004) passa a ler o programa ativo do banco.

### 3.6 Tratamento de Erros
Usuário sem programa ativo → estado tratado (oferece onboarding/builder na 006/007).

## 4. Requisitos

### 4.1 Requisitos Funcionais
- **RF-001:** Persistir programas com dias e exercícios por usuário.
- **RF-002:** Biblioteca de exercícios (globais + custom do usuário).
- **RF-003:** Escadas de skill como dado.
- **RF-004:** Marcar um programa como ativo.

### 4.2 Requisitos Não-Funcionais
- **RNF-001:** Mesmo modelo serve IA (008) e manual (006).
- **RNF-002:** RLS por usuário (programas/dias/exercícios custom).

### 4.3 Restrições e Limitações
Não quebrar o histórico (`sessions`/`entries`) existente.

## 5. Critérios de Aceitação
- [ ] **CA-001:** Tabelas criadas com RLS.
- [ ] **CA-002:** Seed gera um programa equivalente ao `PLAN` atual.
- [ ] **CA-003:** É possível ler o programa ativo de um usuário via API.
- [ ] **CA-004:** Biblioteca distingue exercícios globais de custom.

## 6. Plano de Testes
### 6.1 Testes Unitários
Mapeamento `PLAN` → linhas de programa.
### 6.2 Testes de Integração
Criar programa→dias→exercícios e ler de volta agrupado.
### 6.3 Testes de Aceitação
Programa-modelo idêntico (dias/exercícios) ao plano atual.
### 6.4 Casos de Borda
Exercício sem `exercise_id` (nome livre); programa sem dias; usuário com múltiplos programas (1 ativo).

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Modelo rígido demais p/ casos futuros | Média | Médio | Campos genéricos (unit/min/max); nome livre |
| Migração perder fidelidade do PLAN | Baixa | Médio | Teste comparando seed × PLAN |

## 8. Dependências
### 8.1 Internas
002 (user_id/RLS).
### 8.2 Externas
Nenhuma.

## 9. Observações e Decisões de Design
`day_exercises` aceita tanto `exercise_id` (da biblioteca) quanto `exercise_name` livre, para não
travar o usuário. `target_unit` (reps|seconds) unifica força e isometria. Este modelo é o contrato
que a IA (008) preenche e o builder (006) edita.
