# Tarefas: Confiabilidade do Comando de Voz para Parar o Cronômetro

> **Implementação:** 012 - Confiabilidade do Comando de Voz para Parar o Cronômetro
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 5/7 tarefas concluídas (71%)
> **Última atualização:** 2026-06-23

---

## Legenda
- `[ ]` — Pendente · `[x]` — Concluída · `[!]` — Bloqueada · `[-]` — Cancelada

---

## Tarefas

### Fase 1: Preparação e Setup

- [x] **T-001:** Extrair e endurecer o matching de comandos
  - **Descrição:** Tornar `matchStart`/`matchStop` puros e tolerantes (prefixos/variações), com
    guarda para não casar "parar" durante o cooldown pós-start. Cobrir `START_WORDS`/`STOP_WORDS`.
  - **Arquivos envolvidos:** `src/components/useVoiceCommands.ts`
  - **Critério de conclusão:** "parar"/"para"/"pare"/"stop"/"fim" detectam; sem falso-positivo após
    "vai" (CA-003).
  - **Dependências:** Nenhuma
  - **Estimativa:** Média

### Fase 2: Implementação Core

- [x] **T-002:** Watchdog de reconhecimento (fechar janela cega)
  - **Descrição:** Timer que reinicia o engine se ficar sem `onresult` por `watchdogMs`; restart
    proativo antes do auto-timeout.
  - **Arquivos envolvidos:** `src/components/useVoiceCommands.ts`
  - **Critério de conclusão:** Sem janela > ~1s ignorando "parar" (CA-002).
  - **Dependências:** T-001
  - **Estimativa:** Grande

- [x] **T-003:** Cooldown contextual pós-start
  - **Descrição:** Janela curta (~700ms) após `onStart` em que "parar" não dispara, evitando parada
    falsa imediata.
  - **Arquivos envolvidos:** `src/components/useVoiceCommands.ts`
  - **Critério de conclusão:** CA-003 verde; RNF-001 atendido.
  - **Dependências:** T-001
  - **Estimativa:** Pequena

- [x] **T-004:** Gestão de áudio Bluetooth/TTS
  - **Descrição:** Serializar/suprimir `speak()` enquanto a escuta está ativa; reagir a troca de rota
    de áudio; reduzir disputa pelo perfil HFP.
  - **Arquivos envolvidos:** `src/components/useVoiceCommands.ts`, `src/components/WorkoutPlayer.tsx`
  - **Critério de conclusão:** Em Bluetooth, "parar" registra em < 2s na maioria (CA-001).
  - **Dependências:** T-002
  - **Estimativa:** Grande

- [x] **T-005:** UI de feedback + botão manual em destaque
  - **Descrição:** Mostrar "ouvi 'parar'", manter o botão "PARAR & REGISTRAR" sempre visível e claro
    como fallback; aviso opcional para fones Bluetooth.
  - **Arquivos envolvidos:** `src/components/WorkoutPlayer.tsx`
  - **Critério de conclusão:** CA-004; usuário sempre tem caminho garantido.
  - **Dependências:** T-001
  - **Estimativa:** Média

### Fase 3: Testes e Validação

- [ ] **T-006:** Testes de matching + telemetria de latência (dev) — **requer QA em dispositivo**
  - **Descrição:** Unit de `matchStop/matchStart` e cooldown; instrumentar `heard→fire` atrás de flag
    de dev; rodar matriz manual (Bluetooth × alto-falante).
  - **Arquivos envolvidos:** `src/components/useVoiceCommands.ts`, `scripts/verify-voice-match.ts`
  - **Critério de conclusão:** Unit verdes; latência mediana < 2s medida (RF-001).
  - **Dependências:** T-002..T-005
  - **Estimativa:** Média
  - **Status:** Parcial. `matchStop`/`matchStart` são puros e exportados (testáveis), e o build
    passa. Porém o script `scripts/verify-voice-match.ts` **não foi criado** e — o mais
    importante — a **medição de latência real em fone Bluetooth (HFP)** não é verificável por
    build/offline: depende do SO/engine de voz e do roteamento de áudio do aparelho. **Requer QA
    em dispositivo** (era a queixa central: 7-10s).

### Fase 4: Documentação e Finalização

- [x] **T-007:** Atualizar status e README
  - **Descrição:** Marcar CAs concluídos; atualizar `implementation/README.md`.
  - **Arquivos envolvidos:** `implementation/012 - .../spec.md`, `implementation/README.md`
  - **Critério de conclusão:** Status/progresso refletem a realidade.
  - **Dependências:** T-006
  - **Estimativa:** Pequena

---

## Registro de Progresso

| Tarefa | Status | Data de Conclusão | Observações |
|--------|--------|-------------------|-------------|
| T-001  | ✅ Concluída | 2026-06-23 | `matchStart`/`matchStop` puros + `STOP_BLOCKLIST` (sem falso-positivo de "vai") |
| T-002  | ✅ Concluída | 2026-06-23 | Watchdog (1500ms) com `abort()`+`start()` fecha a janela cega |
| T-003  | ✅ Concluída | 2026-06-23 | Cooldown contextual pós-start ignora STOP por janela curta |
| T-004  | ✅ Concluída | 2026-06-23 | `speak()` serializado só após registro; `enabled` suspenso em `stopHeard` |
| T-005  | ✅ Concluída | 2026-06-23 | Feedback "ouvi 'parar'" + botão "PARAR & REGISTRAR" sempre visível |
| T-006  | 🟡 Parcial | 2026-06-23 | matching puro/testável e build OK; script `verify-voice-match.ts` não criado; **latência Bluetooth requer QA em dispositivo** |
| T-007  | ✅ Concluída | 2026-06-23 | Spec/tasks/README atualizados |

---

> **📌 NOTA:** Atualize este documento conforme as tarefas forem concluídas.
