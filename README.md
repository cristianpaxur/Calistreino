# CalisTreino 💪

App pessoal para controlar treinos de calistenia (plano **Front Lever + Planche**), feito em **Next.js + SQLite**. Roda 100% local — seus dados ficam no arquivo `data/calistreino.db`.

## Funcionalidades

- **Início**: bloco/semana do ciclo de 12 semanas, treino sugerido com botão de iniciar, alavancas atuais, PRs, resumo do Coach e regra de decisão semanal.
- **Treinar (modo guiado)**: passa exercício a exercício com **cronômetro total da sessão**, **timer de descanso** (com bipe + vibração) e **cronômetro de hold** para os isométricos (mede o max-hold e registra cada série). Também há um modo de **registro manual** em formulário.
- **Comando de voz** (nos holds): ative o "MODO VOZ" e fale **"vai"** para iniciar e **"parar"** para registrar — dá pra fazer várias séries sem tocar na tela, com confirmação falada do tempo. Usa a Web Speech API do navegador (precisa de HTTPS e permissão de microfone; melhor suporte no Chrome/Android).
- **Coach 🤖**: analisa suas métricas e recomenda **subir / manter / reduzir** a intensidade por skill, seguindo as regras do plano (avanço de alavanca, deload por cotovelo, alerta lombar). Opcionalmente usa a **IA da OpenAI** para uma análise em linguagem natural.
- **Progressão**: gráficos de max-hold do Front Lever e Planche, escada de alavancas e histórico de dor.
- **Histórico**: todas as sessões agrupadas por mês, com detalhe e exclusão.
- **Plano**: a periodização completa, estrutura semanal, aquecimento, escadas de progressão e segurança da lombar.
- **Acesso protegido por senha** (via env) para poder publicar.

## IA do Coach (OpenAI) — opcional

O Coach funciona **sem IA** (motor de regras determinístico baseado no PDF). Para ativar a análise em linguagem natural, no `.env.local`:

```
OPENAI_API_KEY=sua-chave-aqui
OPENAI_MODEL=gpt-4o-mini
```

Pegue a chave em https://platform.openai.com/api-keys e reinicie o app.

## Como rodar

```bash
npm install
npm run dev
```

Abra http://localhost:3000

Na primeira vez, vá em **Configurações** (⚙️) e defina a data de início do ciclo para o app calcular semana/bloco automaticamente.

### Build de produção

```bash
npm run build
npm start
```

## Backup

Todo o histórico fica em `data/calistreino.db`. Para fazer backup, basta copiar essa pasta.
