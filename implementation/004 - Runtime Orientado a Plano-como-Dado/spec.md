# Runtime Orientado a Plano-como-Dado

> **ID:** 004
> **Status:** 🔵 Em Andamento (código)
> **Prioridade:** 🟠 Alta
> **Criada em:** 2026-06-22
> **Última atualização:** 2026-06-22
> **Autor:** Agente AI

---

## 1. Resumo Executivo

Adaptar o runtime existente (player guiado, telas de treinar/histórico/progressão/coach) para ler o
**programa ativo do usuário no banco** em vez da constante `PLAN`. O comportamento visível continua
igual; muda a fonte dos dados.

## 2. Contexto e Motivação

### 2.1 Problema Atual
Player e páginas importam `PLAN`/`PERIODIZATION`/`FL_PROGRESSION` direto do código. Com plano-como-dado
(003), precisam consumir o programa do usuário.

### 2.2 Impacto do Problema
Sem isto, o trabalho da 003 não chega ao usuário — ele continuaria vendo o plano fixo.

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| Carregar programa no server e passar como props | Mínima mudança no player (client) | Alguns props a mais | ✅ Escolhida |
| Buscar no client via API | Desacoplado | Exporia acesso; mais código | ❌ Descartada |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura
Server Components buscam o programa ativo (003) e passam `day`/`program` como props para o
`WorkoutPlayer` e demais telas — exatamente como hoje já recebem `day` derivado de `PLAN`.

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `src/app/treinar/page.tsx` | Arquivo | Modificar | Dias vindos do programa ativo |
| `src/app/treinar/[day]/page.tsx` | Arquivo | Modificar | Dia vindo do banco |
| `src/components/WorkoutPlayer.tsx` | Arquivo | Modificar | Recebe `day` do banco (mesmo shape) |
| `src/app/page.tsx` (Início) | Arquivo | Modificar | Sugestão/alavancas via programa |
| `src/app/plano/page.tsx` | Arquivo | Modificar | Periodização/dias do programa |
| `src/app/progressao`, `coach` | Arquivo | Modificar | Escadas vindas das `skill_levels` |

### 3.3 Interfaces e Contratos
#### Entradas
`programId`/`userId` (sessão).
#### Saídas
Telas renderizando o programa do usuário.
#### Contratos de API
N/A (consome funções da 003).

### 3.4 Modelos de Dados
Usa Programa/Dia/Exercício/Escada (003). Define um adaptador `dbDay → PlanDay` para minimizar mudanças no player.

### 3.5 Fluxo de Execução
1. Server busca programa ativo + dias.
2. Adapta para o shape que o player já espera.
3. Renderiza; ações de salvar gravam `entries` ligadas ao `day_exercise`.

### 3.6 Tratamento de Erros
Sem programa ativo → CTA para onboarding (007) ou builder (006).

## 4. Requisitos

### 4.1 Requisitos Funcionais
- **RF-001:** Treinar/Plano/Início/Progressão/Coach usam o programa ativo do usuário.
- **RF-002:** Salvar sessão vincula `entries` ao dia/exercício do programa.
- **RF-003:** Escadas de skill vêm de `skill_levels`.

### 4.2 Requisitos Não-Funcionais
- **RNF-001:** Sem regressão visual/UX no player (timers, voz, etc.).

### 4.3 Restrições e Limitações
Reaproveitar o `WorkoutPlayer` (não reescrever).

## 5. Critérios de Aceitação
- [ ] **CA-001:** Player roda o programa ativo do banco, idêntico ao comportamento atual.
- [ ] **CA-002:** Sessões salvas referenciam o programa.
- [ ] **CA-003:** Trocar o programa do usuário muda as telas.
- [ ] **CA-004:** Estado "sem programa" tratado.

## 6. Plano de Testes
### 6.1 Testes Unitários
Adaptador `dbDay → PlanDay`.
### 6.2 Testes de Integração
Programa do banco → player → salvar → histórico.
### 6.3 Testes de Aceitação
Comparar UX com a versão hardcoded (sem diferença perceptível).
### 6.4 Casos de Borda
Programa sem dias de skill; usuário sem programa; programa com exercício de nome livre.

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Regressão no player | Média | Alto | Adaptador mantém o shape; testar fluxo completo |
| Acoplamento residual a `PLAN` | Média | Médio | Buscar e remover imports de `PLAN` no runtime |

## 8. Dependências
### 8.1 Internas
003 (modelo/dados), 002 (sessão).
### 8.2 Externas
Nenhuma.

## 9. Observações e Decisões de Design
Manter o `WorkoutPlayer` recebendo um `PlanDay`-like via adaptador é o que evita reescrever a parte
mais polida do app (timers, voz, escala de dor). `PLAN` deixa de ser importado no runtime e fica só
como semente (003).
