# Resiliência e Edição da Sessão de Treino

> **ID:** 011
> **Status:** 🔵 Em Andamento (código ✅)
> **Prioridade:** 🔴 Crítica
> **Criada em:** 2026-06-23
> **Última atualização:** 2026-06-23
> **Autor:** Agente AI

---

## 1. Resumo Executivo

O estado da sessão ativa do `WorkoutPlayer` é 100% efêmero (React `useState`): qualquer saída da
tela — minimizar, trocar de aba, atualizar (F5), o app ir para segundo plano no celular, ou navegar
para adicionar/consultar um exercício — **zera o treino em andamento**. Esta implementação persiste
a sessão ativa localmente (auto-save + rehidratação), permite **minimizar e retomar** o treino, e
habilita **edição rápida** dos valores já registrados (holds e séries) para corrigir atrasos/erros do
cronômetro ou da voz.

## 2. Contexto e Motivação

### 2.1 Problema Atual
Reportado em teste de uso real (Gustavo, 2026-06-23):
- *"Voltei pra ver algo no app e o meu treino zerou. Então conseguir minimizar vai ser bom."*
- *"Fui adicionar exercício e decidi voltar pro mesmo pra continuar as séries. Ele saiu da seção de
  treino e perdi o que tinha feito."*
- *"Possibilitar a edição rápida do tempo marcado quando houver algum atraso ou erro."*

Na implementação atual ([WorkoutPlayer.tsx](../../src/components/WorkoutPlayer.tsx)):
- Todo o estado vive em `useState` — `entries`, `step`, `elapsed`, `holds`, `setsDone` — sem
  persistência. Ao desmontar o componente (navegação, refresh, background), tudo é perdido.
- O cronômetro `elapsed` é um contador incrementado por `setInterval` em memória — não sobrevive a
  reload (e nem deveria depender só de ticks).
- Os holds só **crescem** via `stopHold()` (`holds: [...holds, secs]`) — **não há como editar ou
  excluir** um hold registrado, nem ajustar o tempo quando o "parar" atrasou (ex.: +7s por voz).

### 2.2 Impacto do Problema
Perda de dados de treino é uma quebra direta de confiança no produto e gatilho de abandono. Afeta
**todo usuário** que usa o player guiado — o núcleo do app. Severidade alta: o usuário faz o esforço
do treino e o registro some.

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| Persistência local (localStorage) + rehidratação + barra "retomar" | Offline, instantâneo, cobre todos os casos (refresh/background/navegação) | Estado só no dispositivo | ✅ Escolhida |
| Autosave remoto a cada ação | Sincroniza entre dispositivos | Latência, custo, não funciona offline | ❌ Descartada (v1) |
| Bloquear navegação (`beforeunload`/confirm) | Simples | Não cobre background no mobile nem o fluxo de adicionar exercício; UX ruim | ❌ Descartada |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura
Introduzir um **draft de sessão ativa** serializável, persistido em `localStorage` sob uma chave
estável (por `programDayId`/`dayCode`/freestyle). O `WorkoutPlayer` salva o draft (debounced) a cada
mudança relevante e **rehidrata no mount**. O tempo decorrido passa a ser derivado de timestamps
(`startedAt` + acumulado), não de um contador em memória — assim sobrevive a reload. Uma barra de
retomada ("Treino em andamento — retomar") aparece quando existe um draft e o usuário não está no
player. Ao salvar o treino (`saveWorkout`) ou descartar, o draft é limpo.

```
iniciar treino → cria/recupera draft ──┐
   cada ação (hold/série/step) ─────────┼─► save(draft) [debounce ~500ms] → localStorage
   minimizar / sair / refresh ──────────┘            │
                                                 barra "retomar" ◄── load(draft) no mount
   salvar treino OU descartar ──────────────────► clear(draft)
```

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `src/lib/session-draft.ts` | Arquivo | Criar | Tipos + `saveDraft/loadDraft/clearDraft/elapsedFrom` (puro/testável) |
| `src/components/WorkoutPlayer.tsx` | Arquivo | Modificar | Estado serializável; persistência + rehidratação; editar/excluir hold e séries; botão "minimizar"; `elapsed` por timestamp |
| `src/components/ResumeWorkoutBar.tsx` | Arquivo | Criar | Barra/CTA de retomada (client) |
| `src/app/treinar/[day]/page.tsx` | Arquivo | Modificar | Passar chave de sessão; montar barra de retomada |
| `src/app/treinar/avulso/page.tsx` | Arquivo | Modificar | Idem para sessão avulsa |
| `src/components/Nav.tsx` (ou `layout.tsx`) | Arquivo | Modificar | (Opcional) exibir a barra de retomada globalmente |
| `scripts/verify-session-draft.ts` | Arquivo | Criar | (Opcional) verificação offline do (de)serialize |

### 3.3 Interfaces e Contratos

#### Entradas
Estado corrente do player (entries, step) + relógio (`Date.now()`).

#### Saídas
`SessionDraft` persistido/recuperado de `localStorage`; player rehidratado.

#### Contratos
```ts
interface SessionDraft {
  v: number;                 // versão do schema (descarta drafts incompatíveis)
  key: string;               // estável: `${programDayId ?? dayCode}|${freestyle ? "free" : "prog"}`
  dayCode: string;
  programDayId: string | null;
  freestyle: boolean;
  entries: EntryState[];     // mesmo shape do player (name, holds, setsDone, done, lever, …)
  step: number;
  startedAt: number;         // epoch ms — base do cronômetro
  accumulatedMs: number;     // tempo acumulado antes de pausas (para elapsed resiliente)
  updatedAt: number;
}
// puras:
function saveDraft(d: SessionDraft): void
function loadDraft(key: string): SessionDraft | null
function clearDraft(key: string): void
function elapsedFrom(d: SessionDraft, now: number): number  // segundos
```

### 3.4 Modelos de Dados
Sem mudança no banco. Persistência apenas em `localStorage` (chave `calistreino:session:<key>`).

### 3.5 Fluxo de Execução
1. Player monta → calcula `key` → `loadDraft(key)`. Se existir e for compatível, rehidrata; senão,
   inicializa do `day` (comportamento atual) e cria o draft.
2. A cada mudança de `entries`/`step` → `saveDraft` (debounced ~500ms). `elapsed` é exibido via
   `elapsedFrom(draft, Date.now())`.
3. "Minimizar" (novo botão) → `router.push("/")` mantendo o draft; a `ResumeWorkoutBar` passa a
   aparecer com "retomar".
4. Adicionar exercício continua no próprio componente (modal `ExercisePicker`) — garantir que NÃO
   desmonta o player; o draft cobre o caso de o usuário sair de fato.
5. Salvar treino (`saveWorkout` OK) → `clearDraft`. Descartar explicitamente → confirma e `clearDraft`.

### 3.6 Tratamento de Erros
- `localStorage` indisponível/quota excedida → captura e segue **sem persistência** (comportamento
  atual), sem quebrar o treino.
- Draft com `v` diferente do atual → descarta silenciosamente.
- Draft órfão (programa trocou) → chave não casa → ignora; oferecer limpeza.

## 4. Requisitos

### 4.1 Requisitos Funcionais
- **RF-001:** Persistir automaticamente a sessão ativa localmente e rehidratar ao reabrir o player
  (não zera ao sair/atualizar/voltar).
- **RF-002:** "Minimizar treino": sair do player mantendo o progresso, com retomada via barra/CTA
  visível.
- **RF-003:** Adicionar exercício durante a sessão sem desmontar o player nem perder o progresso.
- **RF-004:** Editar ou excluir um hold já registrado e ajustar o número de séries após o registro.
- **RF-005:** Corrigir manualmente o tempo de um hold/registro quando o cronômetro/voz atrasou.
- **RF-006:** Limpar o draft ao salvar o treino ou ao descartar explicitamente.

### 4.2 Requisitos Não-Funcionais
- **RNF-001:** Tolerância de ambiente — sem `localStorage`, degrada graciosamente.
- **RNF-002:** Cronômetro resiliente a reload (derivado de timestamp, não de tick em memória).
- **RNF-003:** Sem regressão de performance perceptível (save debounced).

### 4.3 Restrições e Limitações
v1: persistência apenas local (um dispositivo). Sem sincronização remota da sessão em andamento.

## 5. Critérios de Aceitação
> **Código entregue e integrado** (build + `tsc --noEmit` passam): persistência via
> `session-draft.ts`, rehidratação no mount do `WorkoutPlayer`, botão "minimizar" +
> `ResumeWorkoutBar`, `editHold`, e `clearDraft` no salvar/descartar. A validação ponta-a-ponta
> dos CAs abaixo (refresh real, app em segundo plano no celular, toque nos chips/holds) depende do
> preview/dispositivo — **requer QA em dispositivo** e por isso seguem marcados `[ ]`.
- [ ] **CA-001:** Iniciar treino, registrar 2 holds, ir para Início e voltar → progresso e tempo
  continuam. _(requer QA em dispositivo)_
- [ ] **CA-002:** Atualizar a página (F5) no meio do treino → sessão rehidrata no mesmo ponto.
  _(requer QA em dispositivo)_
- [ ] **CA-003:** Em sessão avulsa, adicionar exercício e voltar → nada do que foi feito se perde.
  _(requer QA em dispositivo)_
- [ ] **CA-004:** Tocar num hold já registrado → editar valor ou excluir; máx/total recalculam.
  _(requer QA em dispositivo)_
- [ ] **CA-005:** Salvar o treino → draft é limpo; iniciar de novo começa do zero.
  _(requer QA em dispositivo)_
- [ ] **CA-006:** "Minimizar" → barra "retomar" aparece e devolve ao ponto exato.
  _(requer QA em dispositivo)_

## 6. Plano de Testes
### 6.1 Testes Unitários
`session-draft`: `saveDraft/loadDraft/clearDraft` (round-trip), `elapsedFrom` (timestamp), descarte
por versão.
### 6.2 Testes de Integração
Rehidratação no mount do `WorkoutPlayer`; limpeza após `saveWorkout`.
### 6.3 Testes de Aceitação
Percorrer CA-001..006 no preview (`npm run dev` + ferramentas de preview).
### 6.4 Casos de Borda
Quota de localStorage cheia; dois treinos diferentes (chaves distintas); draft órfão de programa
antigo; reload durante hold em andamento; aba duplicada.

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Divergência draft × programa ativo | Média | Médio | Chave por `programDayId` + versão `v`; descartar incompatível |
| Cronômetro impreciso após reload | Média | Médio | Derivar de `startedAt`/`accumulatedMs` |
| Conflito entre abas | Baixa | Baixo | Última escrita vence; `updatedAt` para escolher |

## 8. Dependências
### 8.1 Dependências Internas
004 (runtime/player), 006 (sessão avulsa / `ExercisePicker`).
### 8.2 Dependências Externas
`localStorage` do navegador.

## 9. Observações e Decisões de Design
A persistência é **local de propósito** (v1) — resolve 100% dos relatos com custo zero e offline.
Sincronização remota da sessão em andamento fica como evolução futura. A edição de holds (RF-004/005)
ataca diretamente o caso em que o "parar" por voz atrasou — complementa a implementação **012**.

---

> **⚠️ NOTA:** Documento é a fonte de verdade desta implementação. Alterações de escopo devem ser
> refletidas aqui ANTES de implementadas.
