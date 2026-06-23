# Reclassificação de Exercícios (Estáticos × Dinâmicos)

> **ID:** 013
> **Status:** 🔵 Em Andamento (código ✅)
> **Prioridade:** 🟡 Média
> **Criada em:** 2026-06-23
> **Última atualização:** 2026-06-23
> **Autor:** Agente AI

---

## 1. Resumo Executivo

Hoje a divisão de exercícios é **Skill × Força** (`isSkill` + `Category`), o que mistura dois eixos
distintos: o **tipo de medição** (hold em segundos × repetições) e o **papel** (skill × força). Isso
gera imprecisão — exercícios **estáticos não-skill** (hollow hold, prancha, isometrias de core) caem
no contador de séries em vez do cronômetro de hold, e **skills dinâmicas** (muscle-up) podem cair no
cronômetro. Esta implementação introduz o eixo **Estático × Dinâmico** (derivado da unidade-alvo:
segundos = estático/hold; reps = dinâmico) para dirigir o **modo do player** e os **rótulos** com
precisão, mantendo `category`/`isSkill` como metadados secundários.

## 2. Contexto e Motivação

### 2.1 Problema Atual
Reportado em teste de uso real (Gustavo, 2026-06-23):
- *"Acredito que a divisão dos exercícios ficaria mais precisa usando exercícios trocando a
  classificação de Skill para estáticos e exercícios de força para dinâmicos."*

Na implementação atual:
- `WorkoutPlayer` escolhe o modo (cronômetro de **max-hold** × contador de **séries**) por
  `cur.isSkill` ([WorkoutPlayer.tsx:421](../../src/components/WorkoutPlayer.tsx)).
- O catálogo já distingue a **unidade**: `ExerciseOption.defaultUnit: "reps" | "seconds"`
  ([exercise-catalog.ts:18](../../src/lib/exercise-catalog.ts)); os templates marcam `unit: "seconds"`
  em slots isométricos ([templates.ts](../../supabase/seeds/templates.ts), ex.: `CORE_SLOT` =
  hollow-body-hold, `isSkill: false, unit: "seconds"`).
- **Mas** o player ignora a unidade e usa só `isSkill`: o `CORE_SLOT` (hold cronometrado, não-skill)
  aparece como **contador de séries**, perdendo o registro do tempo de hold. Essa é a imprecisão
  apontada.
- `Category = skill | forca | core | pernas` rotula cor/label (`CAT`/`catOf` em
  [ui.tsx](../../src/components/ui.tsx)), mas não captura o eixo estático×dinâmico.

### 2.2 Impacto do Problema
Registro impreciso de isométricos não-skill (mede séries quando deveria medir tempo), prejudicando o
log e a progressão por hold. Impacto **médio** — melhora a fidelidade do dado, mas não bloqueia o uso.

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| Derivar Estático×Dinâmico da **unidade-alvo** existente (`seconds`×`reps`) e usar como driver do player + rótulo | Sem migração; reaproveita `target_unit`/`defaultUnit`/`unit`; baixo risco | Depende da unidade estar correta nos dados | ✅ Escolhida |
| Coluna nova `movement_type` no banco + migração + backfill | Eixo explícito e persistido | Migração, backfill, mais escopo | ⚠️ Evolução futura |
| Renomear `Category` globalmente para estático/dinâmico | Conceito único | Quebra muito código/labels; perde papel (core/pernas) | ❌ Descartada |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura
Helper puro `isStatic(exercise)` / `movementType(exercise)` que decide pelo eixo de medição
(unidade-alvo `seconds`/hold), com fallback para a heurística atual (`isSkill` isométrico) quando a
unidade não estiver disponível. O `WorkoutPlayer` passa a escolher o modo por `isStatic`, **não** por
`isSkill`. A rotulagem ganha o eixo **ESTÁTICO/DINÂMICO** (mantendo SKILL/FORÇA/CORE/PERNAS como
categoria/cor).

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `src/lib/exercise-classify.ts` | Arquivo | Criar | `isStatic`/`movementType` (puro, testável) |
| `src/components/WorkoutPlayer.tsx` | Arquivo | Modificar | Modo por `isStatic`; `EntryState` carrega `unit`/`isStatic` |
| `src/components/ui.tsx` | Arquivo | Modificar | Chip/rotulagem do eixo movimento (`MovementChip` ou extensão de `catOf`) |
| `src/lib/exercise-catalog.ts` | Arquivo | Modificar | Propagar `defaultUnit` onde o player precisa derivar |
| `src/lib/plan.ts` / `program-adapter.ts` | Arquivo | Modificar | Garantir que `PlanExercise`/adaptação exponham a unidade-alvo |
| `supabase/seeds/templates.ts`, `supabase/seeds/exercises.ts` | Arquivo | Modificar | Conferir `unit`/`default_unit` corretos nos estáticos |
| `supabase/migrations/0NN_movement_type.sql` | Arquivo | (Futuro) | Coluna explícita — fora do escopo v1 |

### 3.3 Interfaces e Contratos
```ts
type MovementType = "static" | "dynamic";
// puro:
function isStatic(ex: { unit?: string; targetUnit?: string; defaultUnit?: string; isSkill?: boolean }): boolean
function movementType(ex): MovementType   // "static" => hold/segundos; "dynamic" => reps
```
Regra: `static` quando a unidade efetiva é `seconds` (hold); senão `dynamic`. Fallback: se faltar
unidade, usar `isSkill` isométrico → `static` (preserva o comportamento de FL/Planche).

#### Entradas
Exercício do plano/sessão/catálogo (com `target_unit`/`default_unit`/`unit`).
#### Saídas
`MovementType` que dirige o modo do player e o chip de rótulo.

### 3.4 Modelos de Dados
**Sem migração obrigatória.** Deriva de campos existentes: `day_exercises.target_unit`,
`exercise_library.default_unit`, `TemplateSlot.unit`, `ExerciseOption.defaultUnit`. Persistir o eixo
explicitamente fica como evolução futura.

### 3.5 Fluxo de Execução
1. Player monta cada `entry` resolvendo `isStatic` pela unidade-alvo (fallback `isSkill`).
2. Se `static` → renderiza o cronômetro de **max-hold** (com voz/edição das outras specs).
3. Se `dynamic` → renderiza o **contador de séries/reps**.
4. Chips em treinar/picker/sessão exibem ESTÁTICO/DINÂMICO além da categoria atual.

### 3.6 Tratamento de Erros
Unidade ausente/ambígua → fallback para a heurística `isSkill` (sem regressão). Exercício marcado
estático mas sem holds → registra 0/—, igual hoje.

## 4. Requisitos

### 4.1 Requisitos Funcionais
- **RF-001:** Classificar cada exercício em **Estático** (hold/segundos) × **Dinâmico** (reps),
  derivado da unidade-alvo.
- **RF-002:** O player escolhe **cronômetro de hold** para estáticos e **contador de séries** para
  dinâmicos — independente de skill×força.
- **RF-003:** Exibir o eixo movimento nos chips/rótulos (treinar, picker, sessão), mantendo a
  categoria/cor atual.
- **RF-004:** Não exigir migração de dados; reaproveitar as unidades já existentes.

### 4.2 Requisitos Não-Funcionais
- **RNF-001:** Retrocompatível com sessões/planos/histórico existentes (sem quebrar `saveWorkout`).
- **RNF-002:** Lógica de classificação pura e testável offline.

### 4.3 Restrições e Limitações
v1 deriva da unidade; não cria coluna nova nem reescreve a taxonomia `Category`.

## 5. Critérios de Aceitação
> **Código entregue e integrado** (build + `tsc --noEmit` passam): `isStatic`/`movementType` puros,
> player decidindo o modo por `cur.isStatic` (linha 587 do `WorkoutPlayer`), `saveWorkout` gravando
> `maxHold/sets/repsOrTime` por `isStatic`, e `MovementChip` em treinar/picker/sessão.
- [ ] **CA-001:** Hollow hold (não-skill, segundos) abre o **cronômetro de hold** no player, não o
  contador de séries. _(lógica integrada por `isStatic`; confirmação visual requer QA em dispositivo;
  no fallback PLAN embutido o hollow hold ainda cai como dinâmico — ver §3.6)_
- [ ] **CA-002:** Muscle-up / pull-up (reps) abre o **contador de séries/reps** adequado.
  _(lógica integrada; confirmação visual requer QA em dispositivo)_
- [ ] **CA-003:** Chips mostram ESTÁTICO/DINÂMICO corretamente em treinar/picker/sessão.
  _(`MovementChip` integrado nas três telas; confirmação visual requer QA em dispositivo)_
- [x] **CA-004:** Planos e histórico antigos seguem abrindo sem erro (retrocompatibilidade).
  _(`verify:plan`/`verify:content` passam; fallback `isSkill` cobre unidade ausente — sem quebra de `saveWorkout`)_

## 6. Plano de Testes
### 6.1 Testes Unitários
`isStatic`/`movementType` por unidade e por fallback `isSkill`; casos `seconds`/`reps`/ausente.
### 6.2 Testes de Integração
Player escolhe o modo certo para uma amostra (FL, hollow hold, pull-up, muscle-up, prancha).
### 6.3 Testes de Aceitação
Percorrer CA-001..004 no preview; conferir `npm run verify:plan`/`verify:content` após ajustes de
unidade nos seeds.
### 6.4 Casos de Borda
Exercício custom sem unidade; exercício com unidade divergente entre seed e banco; isométrico de skill
dinâmica (muscle-up transition negative — segundos).

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Unidade incorreta em alguns seeds | Média | Médio | Auditoria via `verify:plan`; corrigir `unit`/`default_unit` |
| Divergência seed × banco | Baixa | Médio | Derivar sempre da unidade efetiva do runtime |
| Exercícios ambíguos | Baixa | Baixo | Regra clara pela unidade; fallback `isSkill` |

## 8. Dependências
### 8.1 Dependências Internas
003 (modelo de dados/biblioteca), 004 (player), 005 (catálogo/escadas).
### 8.2 Dependências Externas
Nenhuma.

## 9. Observações e Decisões de Design
Mantemos `Category` (skill/forca/core/pernas) para **cor e papel** e adicionamos o eixo de
**movimento** (estático/dinâmico) para **medição**. Os dois eixos são complementares — isso resolve a
imprecisão sem reescrever a taxonomia nem migrar dados. A coluna `movement_type` persistida fica
documentada como evolução futura caso se queira sobrescrever a derivação por unidade.

---

> **⚠️ NOTA:** Documento é a fonte de verdade desta implementação.
