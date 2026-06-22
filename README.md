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

## Banco de dados (Postgres / Supabase)

O app usa **Postgres** via `postgres.js` (funciona com qualquer provedor: Supabase, Neon, etc.).
Defina `DATABASE_URL` com a connection string do **pooler de transações** (porta 6543).
As tabelas são criadas automaticamente no primeiro acesso.

## Supabase (passo a passo)

1. Crie um projeto grátis em https://supabase.com.
2. **Project Settings → Database → Connection string → "Transaction pooler"** (porta **6543**).
   Copie a URL e troque `[YOUR-PASSWORD]` pela senha do banco.
   Formato: `postgresql://postgres.<ref>:<SENHA>@aws-0-<regiao>.pooler.supabase.com:6543/postgres`

## Como rodar (local)

```bash
npm install
# cole a connection string do Supabase em .env.local:
# DATABASE_URL=postgresql://postgres.<ref>:<SENHA>@aws-0-<regiao>.pooler.supabase.com:6543/postgres
npm run dev
```

Abra http://localhost:3000 → na primeira vez, vá em **⚙️ Ajustes** e defina a data de início do ciclo.

## Deploy no Vercel

1. Importe o repositório no Vercel.
2. Em **Settings → Environment Variables**, adicione:
   - `DATABASE_URL` = a connection string do pooler do Supabase (porta 6543)
   - `APP_PASSWORD`, `AUTH_SECRET`
   - (opcional) `OPENAI_API_KEY`, `OPENAI_MODEL`
3. **Redeploy.** As tabelas são criadas no primeiro acesso.

> ⚠️ O SQLite em arquivo **não funciona** no Vercel (filesystem efêmero/somente-leitura) — por isso o banco é Postgres.
> Use sempre a string do **pooler (6543)**, não a conexão direta (5432) — o driver já está configurado com `prepare: false` para o pgbouncer.

## Backup

Os dados ficam no Postgres. Faça backup pelo painel da Neon/Vercel (snapshots) ou `pg_dump`.
