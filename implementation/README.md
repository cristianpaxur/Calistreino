# Plano de Implementação — CalisTreino (Produto)

Índice das implementações que levam o CalisTreino de app pessoal a produto multiusuário,
seguindo **Spec-Driven Development**. Cada pasta tem `spec.md` (contrato) e `tasks.md` (execução).

## Decomposição

| # | Implementação | Status | Prioridade | Depende de |
|---|---|---|---|---|
| 001 | Verificação do Supabase e Deploy no Vercel | 🔵 Em Andamento (smoke test ✅; deploy pendente) | 🔴 Crítica | — |
| 002 | Contas de Usuário e Autenticação (Multi-Tenant) | 🔵 Em Andamento (código ✅; portões humanos) | 🔴 Crítica | 001 |
| 003 | Modelo de Dados Unificado (Programa/Dia/Exercício/Biblioteca) | 🔵 Em Andamento (código ✅) | 🔴 Crítica | 002 |
| 004 | Runtime Orientado a Plano-como-Dado | 🔵 Em Andamento (código ✅) | 🟠 Alta | 003 |
| 005 | Biblioteca de Exercícios e Escadas de Progressão | 🔵 Em Andamento (código ✅) | 🟠 Alta | 003 |
| 006 | Construtor de Treinos Manual e Sessão Avulsa (Freestyle) | 🔵 Em Andamento (código ✅) | 🟠 Alta | 004, 005 |
| 007 | Onboarding com Bifurcação e Anamnese Estruturada | 🔵 Em Andamento (código ✅) | 🟠 Alta | 002, 006 |
| 008 | Templates de Programa e Geração de Plano por IA | 🔵 Em Andamento (código ✅) | 🟡 Média | 005, 007 |
| 009 | Acompanhamento Adaptativo, Milestones e Loop de Objetivo | 🔵 Em Andamento (código ✅) | 🟡 Média | 004, 008 |
| 010 | Monetização Freemium e Controle de Acesso | 🔵 Em Andamento (código ✅) | 🟢 Baixa | 002, 008, 009 |
| 011 | Resiliência e Edição da Sessão de Treino | 🔵 Em Andamento (código ✅) | 🔴 Crítica | 004, 006 |
| 012 | Confiabilidade do Comando de Voz para Parar o Cronômetro | 🔵 Em Andamento (código ✅) | 🟠 Alta | 004 |
| 013 | Reclassificação de Exercícios (Estáticos × Dinâmicos) | 🔵 Em Andamento (código ✅) | 🟡 Média | 003, 004, 005 |

> **Lote de feedback de teste de uso (Gustavo, 2026-06-23).** 011–013 nascem de pontos levantados em
> teste real do player de treino. 011 é **crítica** (perda de dados da sessão ativa). As melhorias de
> jornada/onboarding/freemium planejadas à parte entram como 014+ quando forem para execução.

## Ordem de execução recomendada

```
001 → 002 → 003 → 004 ─┬─ 005 ──┬─ 006 ── 007 ── 008 ── 009 ── 010
                       └────────┘
```

- **001–002**: fundação (deploy estável + contas). Bloqueiam todo o resto.
- **003–005**: dados e conteúdo (plano-como-dado + biblioteca). 004 e 005 podem rodar em paralelo após 003.
- **006–007**: as duas portas de entrada (freestyle + onboarding/anamnese).
- **008–009**: camada de IA e acompanhamento (a diferenciação).
- **010**: monetização, por último.

## Marcos (milestones de produto)

- **M1 — App público estável** (após 002): multiusuário, deploy ok.
- **M2 — Logger freestyle (MVP de mercado)** (após 006): qualquer um cria treino e registra. É a cunha grátis.
- **M3 — Coach com IA** (após 009): anamnese → plano → acompanhamento fim-a-fim.
- **M4 — Monetizável** (após 010): freemium ligado.

## Reaproveitamento do que já existe

Player guiado (cronômetro de hold/descanso, comando de voz), registro de sessão, escadas de skill,
periodização de 12 semanas, coach (motor de regras + IA OpenAI opcional), histórico/heatmap/progressão,
banco no Supabase via API. O trabalho é **generalizar** (multiusuário + plano-como-dado), não refazer.

> Atualize a coluna **Status** sempre que uma implementação avançar.
