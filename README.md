# CalisTreino 💪

App de calistenia (plano **Front Lever + Planche**), feito em **Next.js + Supabase**. Os dados ficam no Postgres do Supabase, acessado pela **API (PostgREST/supabase-js)** — sem conexão TCP.

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

## Banco de dados (Supabase)

O app usa o **Supabase** via API (`@supabase/supabase-js`/PostgREST) sobre HTTPS — ideal para
serverless (sem limite de conexão/TCP). A API **não cria tabelas**, então o schema fica em
[`supabase/schema.sql`](supabase/schema.sql) (rode uma vez no SQL Editor).

## Supabase (passo a passo)

1. Crie um projeto grátis em https://supabase.com.
2. **SQL Editor** → cole e rode o `supabase/schema.sql` (cria tabelas + habilita RLS).
3. **Project Settings → API** → copie o **Project URL** e a chave **`service_role`** (secreta, só servidor).

## Como rodar (local)

```bash
npm install
# em .env.local:
# SUPABASE_URL=https://<ref>.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=<service_role>
npm run dev
```

Abra http://localhost:3000 → na primeira vez, vá em **⚙️ Ajustes** e defina a data de início do ciclo.

## Deploy no Vercel

1. Importe o repositório no Vercel.
2. Em **Settings → Environment Variables**, adicione:
   - `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
   - `APP_PASSWORD`, `AUTH_SECRET`
   - (opcional) `OPENAI_API_KEY`, `OPENAI_MODEL`
3. **Redeploy.**

> ⚠️ A chave `service_role` é secreta e **só pode ser usada no servidor** — nunca no front-end.

## Backup

Os dados ficam no Postgres do Supabase. Faça backup pelo painel do Supabase (Database → Backups) ou `pg_dump`.
