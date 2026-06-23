# Confiabilidade do Comando de Voz para Parar o Cronômetro

> **ID:** 012
> **Status:** 🔵 Em Andamento (código ✅)
> **Prioridade:** 🟠 Alta
> **Criada em:** 2026-06-23
> **Última atualização:** 2026-06-23
> **Autor:** Agente AI

---

## 1. Resumo Executivo

O comando de voz para **parar** o cronômetro de hold atrasa de **3 a 10 segundos** (às vezes exigindo
2 tentativas), sobretudo com **fones Bluetooth**, enquanto o comando "VAI" (iniciar) funciona bem.
Esta implementação torna a detecção do "parar" **mais rápida e robusta**: reinício do reconhecimento
sem janelas cegas, watchdog, matching tolerante, e melhor compatibilidade com áudio Bluetooth (HFP),
mantendo o botão manual sempre acessível como fallback imediato.

## 2. Contexto e Motivação

### 2.1 Problema Atual
Reportado em teste de uso real (Gustavo, 2026-06-23):
- *"Também notei problemas no comando de voz para parar o cronômetro, com atrasos entre 3 e 10
  segundos."*
- *"Pra acionar de boa, mas pra parar nao ia. Desconectei e testei."* (fone Bluetooth)
- *"Tive problema na hora de parar por comando de voz. Fui conseguir depois de 7 segundos."*
- *"Fui conseguir depois de 10 segundos. Nao sei se tem a ver com o fato de eu estar de fone
  Bluetooth..."*
- *"Precisei de 2 tentativas o que me atrasou em 3 segundos."*

Na implementação atual ([useVoiceCommands.ts](../../src/components/useVoiceCommands.ts)):
- Reconhecimento contínuo (`continuous = true`, `interimResults = true`) que **para sozinho e
  reinicia em `onend`** — durante a reinicialização existe uma **janela cega** em que a fala não é
  capturada. No mobile/Bluetooth essa janela é maior e mais frequente.
- Matching por palavra inteira com fronteiras: `new RegExp("(^|\\s)" + w + "(\\s|$)")` — pode perder
  formas parciais vindas de resultados interinos e variações.
- Debounce `lastFire` de 900ms protege contra disparo repetido, mas não acelera a detecção.
- Sem **watchdog**: se o engine "morre" silenciosamente, nada o reinicia até o próximo `onend`.
- Bluetooth: o perfil de microfone (HFP) tem latência e pode reroutar o áudio; o engine demora a
  emitir o resultado final de "parar".

### 2.2 Impacto do Problema
O modo voz hands-free é um **diferencial do produto** e falha justo no momento crítico — registrar o
hold. O atraso corrompe o valor medido (o hold continua "correndo" enquanto a voz não para),
exigindo correção manual (ver implementação **011 / RF-005**). Frustra o usuário e descredibiliza o
recurso.

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| Hardening do Web Speech (restart proativo, watchdog, matching tolerante, gerir TTS/Bluetooth) | Sem dependência nova; ataca a causa raiz | Web Speech é inconsistente entre navegadores | ✅ Escolhida |
| Engine/lib de reconhecimento externa | Possível mais robusto | Peso, custo, ainda depende do browser/permissões | ❌ Descartada (v1) |
| Só botão manual (remover voz) | Simples | Perde o hands-free (diferencial) | ❌ Descartada (manter botão como fallback) |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura
Reforçar o hook `useVoiceCommands` com uma estratégia de escuta mais resiliente:
1. **Restart proativo + watchdog:** reiniciar o reconhecimento antes do auto-timeout e um watchdog
   que o reinicia se ficar sem `onresult` por N segundos, fechando a janela cega.
2. **Matching de parada tolerante:** detectar "parar" por inclusão tolerante (prefixos/variações:
   `par`, `para`, `parar`, `pára`, `pare`, `parou`, `stop`, `fim`, `pronto`, `chega`) priorizando
   latência, **sem** gerar falso-positivo logo após "vai".
2b. **Cooldown contextual:** janela curta após `onStart` para evitar parada falsa imediata.
3. **Gestão de áudio Bluetooth/TTS:** evitar disputar o canal — opcionalmente **suprimir/serializar**
   o `speak()` de confirmação enquanto a escuta está ativa; reconhecer mudança de rota de áudio.
4. **Telemetria leve de latência (dev):** medir `heard → fire` para validar a melhoria.

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `src/components/useVoiceCommands.ts` | Arquivo | Modificar | Núcleo: watchdog, restart proativo, matching tolerante, cooldown, gestão de TTS/Bluetooth |
| `src/components/WorkoutPlayer.tsx` | Arquivo | Modificar | Feedback "ouvi 'parar'", botão manual sempre destacado, aviso de Bluetooth quando aplicável; serializar `speak()` |

### 3.3 Interfaces e Contratos
Mantém a assinatura pública de `useVoiceCommands({ enabled, isRunning, onStart, onStop, lang })`.
Acrescentar (internos/opcionais): `watchdogMs`, `cooldownMs`, e no retorno `lastLatencyMs?` (dev).

#### Entradas
Stream de reconhecimento (`onresult` interim+final), `isRunning` (hold ativo), permissões de microfone.
#### Saídas
Disparo de `onStop()`/`onStart()`; estados `listening/heard/error` para a UI.
#### Contratos de API
Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`) — já abstraída no hook.

### 3.4 Modelos de Dados
N/A — sem persistência.

### 3.5 Fluxo de Execução
1. Hold em andamento (`isRunning = true`) → engine escutando.
2. `onresult` (interim ou final) → normaliza texto → `matchStop(text)` tolerante → se casar e fora do
   cooldown → `onStop()` imediato.
3. Watchdog: sem `onresult` por `watchdogMs` → `abort()` + `start()` (fecha janela cega).
4. `onend` → reinício imediato se ainda habilitado (mantido), agora coberto também pelo watchdog.
5. Confirmação por voz (`speak`) só após o registro e **sem** competir com a captura (serializada).

### 3.6 Tratamento de Erros
- `not-allowed`/`service-not-allowed` → mensagem de microfone bloqueado (mantido).
- `no-speech`/`aborted`/`network` → ignora; watchdog/`onend` reiniciam.
- Engine indisponível (sem Web Speech) → `supported = false`; UI mostra botão manual.

## 4. Requisitos

### 4.1 Requisitos Funcionais
- **RF-001:** Reduzir a latência mediana de detecção do "parar" para **< 2s** em condições normais.
- **RF-002:** Robustez com **Bluetooth (HFP)** — não exigir 2 tentativas no caso típico.
- **RF-003:** Eliminar/minimizar a janela cega entre reinícios (watchdog + restart proativo).
- **RF-004:** Matching de parada tolerante a formas parciais/variações, **sem** falso-positivo logo
  após "vai".
- **RF-005:** Botão "PARAR & REGISTRAR" sempre acessível e destacado como fallback imediato.

### 4.2 Requisitos Não-Funcionais
- **RNF-001:** Não disparar parada falsa nos ~700ms após o início do hold (cooldown contextual).
- **RNF-002:** Compatibilidade preservada com navegadores sem Web Speech (degrada para manual).
- **RNF-003:** Sem aumento perceptível de consumo de bateria/CPU.

### 4.3 Restrições e Limitações
A confiabilidade final depende do navegador/SO (Web Speech é inconsistente). Meta é "bom o
suficiente" + fallback manual, não 100% determinístico.

## 5. Critérios de Aceitação
> **Código entregue e integrado** (build + `tsc --noEmit` passam): matching tolerante com blocklist,
> watchdog (1500ms), cooldown contextual pós-start, serialização do `speak()` e botão manual
> sempre visível. **Todos os CAs abaixo dependem de hardware/navegador/microfone** (latência real em
> Bluetooth-HFP, comportamento de `onend`/morte silenciosa do engine, cadência de transcrição interim,
> ausência efetiva de Web Speech) e **não podem ser confirmados por build/offline** — seguem `[ ]`,
> requerem QA em dispositivo.
- [ ] **CA-001:** Com fone Bluetooth, iniciar hold e dizer "parar" → registra em < 2s na maioria das
  tentativas. _(requer QA em dispositivo — latência HFP depende do SO/engine de voz)_
- [ ] **CA-002:** Não há janela > ~1s em que "parar" é ignorado (watchdog cobre).
  _(requer QA em dispositivo — depende do `onend`/morte silenciosa do engine)_
- [ ] **CA-003:** "vai" seguido rápido de "parar" não gera parada falsa imediata.
  _(cooldown de 700ms cobre logicamente; confirmação real requer QA em dispositivo)_
- [ ] **CA-004:** Sem Web Speech suportado → botão manual visível e funcional.
  _(botão e `vc.supported` no código; ausência real de Web Speech só em navegadores específicos — requer QA)_

## 6. Plano de Testes
### 6.1 Testes Unitários
`matchStop`/`matchStart` (tolerância e ausência de falso-positivo); lógica de cooldown.
### 6.2 Testes de Integração
Hook em ambiente com mock de `SpeechRecognition`: watchdog reinicia; interim dispara stop.
### 6.3 Testes de Aceitação
Matriz manual: alto-falante do aparelho × fone Bluetooth × navegadores; medir latência `heard→fire`.
### 6.4 Casos de Borda
Troca de rota de áudio no meio do hold; ruído ambiente; "parar" sussurrado; perda momentânea de rede.

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Inconsistência entre navegadores/SO | Alta | Médio | Watchdog + fallback manual sempre visível |
| Falso-positivo de "parar" | Média | Médio | Cooldown contextual + matching com guarda pós-start |
| Bluetooth reroteia/atrasa áudio | Média | Médio | Restart proativo; serializar TTS; aviso ao usuário |

## 8. Dependências
### 8.1 Dependências Internas
004 (player). Complementa 011 (edição corrige registros atrasados).
### 8.2 Dependências Externas
Web Speech API do navegador; permissão de microfone.

## 9. Observações e Decisões de Design
O botão manual **permanece** como caminho garantido — a voz é otimização, não dependência. A
serialização do `speak()` de confirmação é importante em Bluetooth, onde entrada e saída disputam o
mesmo perfil HFP. Telemetria de latência fica atrás de flag de dev para não pesar em produção.

---

> **⚠️ NOTA:** Documento é a fonte de verdade desta implementação.
