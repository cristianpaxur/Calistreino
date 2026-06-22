# Construtor de Treinos Manual e Sessão Avulsa (Freestyle)

> **ID:** 006
> **Status:** 🔵 Em Andamento (código)
> **Prioridade:** 🟠 Alta
> **Criada em:** 2026-06-22
> **Última atualização:** 2026-06-22
> **Autor:** Agente AI

---

## 1. Resumo Executivo

Dar ao usuário experiente a **via expressa**: montar os próprios treinos (construtor de rotina) e
registrar **sessões avulsas** (modelo Hevy: começa vazio, adiciona exercício na hora). Tudo grava no
mesmo modelo de dados (003) e roda no mesmo player. É o MVP de mercado / cunha grátis.

## 2. Contexto e Motivação

### 2.1 Problema Atual
Quem já treina não quer onboarding nem plano de IA — quer logar. Hoje o app só oferece o plano fixo.

### 2.2 Impacto do Problema
Sem o modo freestyle, o produto exclui o segmento que mais loga e que é a base grátis de aquisição.

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| Builder de rotina + sessão avulsa sobre o modelo unificado | Reusa player/dados; serve free e funil de IA | UI de builder a construir | ✅ Escolhida |
| Só sessão avulsa | Mais simples | Sem rotina reutilizável (retém menos) | ❌ Descartada (parcial) |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura
Builder cria um `program` (source=manual) com dias/exercícios escolhidos da biblioteca (005) ou custom.
Sessão avulsa cria uma "sessão" sem dia fixo, com exercícios adicionados em runtime, salvando `entries`
sem `program_day_id`.

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `src/app/montar/*` | Arquivo | Criar | Builder de rotina/dia |
| `src/components/RoutineBuilder.tsx` | Arquivo | Criar | UI de montagem |
| `src/components/ExercisePicker.tsx` | Arquivo | Criar | Busca na biblioteca + custom |
| `src/app/treinar/avulso/*` | Arquivo | Criar | Sessão avulsa |
| `src/app/actions.ts` | Arquivo | Modificar | Salvar rotina e sessão avulsa |

### 3.3 Interfaces e Contratos
#### Entradas
Seleção de exercícios + alvos (séries×reps/hold, RIR, descanso).
#### Saídas
Programa manual salvo / sessão avulsa registrada.
#### Contratos de API
Consome funções de programa (003) e biblioteca (005).

### 3.4 Modelos de Dados
Reusa 003. Exercício custom vira `exercise_library` com `owner_user_id`.

### 3.5 Fluxo de Execução
1. Builder: nomear rotina → adicionar dias → adicionar exercícios (picker) → definir alvos → salvar/ativar.
2. Avulso: "treino de hoje" vazio → adicionar exercício → player → salvar.

### 3.6 Tratamento de Erros
Validações (rotina sem exercício; alvo inválido). Exercício custom duplicado → reutiliza.

## 4. Requisitos

### 4.1 Requisitos Funcionais
- **RF-001:** Criar/editar rotina (dias + exercícios + alvos) e ativá-la.
- **RF-002:** Buscar exercícios na biblioteca e criar exercício custom.
- **RF-003:** Iniciar sessão avulsa e adicionar exercícios na hora.
- **RF-004:** Rodar rotina/avulso no player existente (timers/voz).

### 4.2 Requisitos Não-Funcionais
- **RNF-001:** Fluxo rápido (mínimos toques) para o usuário experiente.

### 4.3 Restrições e Limitações
Reusar `WorkoutPlayer` e o modelo 003 (sem novo runtime).

## 5. Critérios de Aceitação
- [ ] **CA-001:** Usuário monta uma rotina do zero e a executa.
- [ ] **CA-002:** Sessão avulsa registra exercícios adicionados em runtime.
- [ ] **CA-003:** Exercício custom é criado e reutilizável.
- [ ] **CA-004:** Tudo aparece no histórico/progressão como qualquer sessão.

## 6. Plano de Testes
### 6.1 Testes Unitários
Validação de rotina/alvos.
### 6.2 Testes de Integração
Montar rotina → ativar → treinar → salvar → histórico.
### 6.3 Testes de Aceitação
Sessão avulsa ponta a ponta.
### 6.4 Casos de Borda
Rotina vazia; exercício custom igual a um global; avulso sem nenhum exercício.

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Builder complexo demais | Média | Médio | v1 enxuto (dia → lista → alvo); iterar |
| Inconsistência com o player | Baixa | Médio | Usar o mesmo adaptador da 004 |

## 8. Dependências
### 8.1 Internas
004 (runtime por dado), 005 (biblioteca), 003 (modelo).
### 8.2 Externas
Nenhuma.

## 9. Observações e Decisões de Design
Este é o **modo grátis** e a cunha de mercado: ganha de loggers genéricos nos diferenciais de
calistenia (hold timer, voz, escadas). Também é o funil: dados gerados aqui alimentam o upsell de IA (009/010).
