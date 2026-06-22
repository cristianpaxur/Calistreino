# GO-LIVE — Checklist de portões humanos (CalisTreino)

Estado: **todo o código de 001–010 está escrito, `next build` verde e a lógica pura passa nos
testes offline** (`npm run verify:*`). O que falta para rodar ao vivo é ação humana (migrações,
conteúdo, chaves, testes ao vivo). Faça na ordem abaixo. Cada bloco é independente o suficiente
para parar e validar.

> ⚠️ **Segurança:** a `service_role`, a `anon` e a `OPENAI_API_KEY` apareceram no chat.
> **Rotacione todas** quando estabilizar e atualize `.env.local` + Vercel.

---

## Fase A — Banco + Contas (desbloqueia 002, 003, 004, 005, 006)

1. **Backup** do banco (Supabase → Database → Backups).
2. **SQL Editor**, na ordem:
   - `supabase/schema.sql` (se ainda não rodou — cria tabelas + RLS base)
   - `supabase/migrations/002_multitenant.sql` (user_id, defaults, políticas RLS)
   - `supabase/migrations/003_program_model.sql` (biblioteca, skills, programs/days/exercises)
   - `supabase/migrations/007_profiles.sql` (anamnese → perfil)
   - `supabase/migrations/008_program_meta.sql` (coluna de auditoria do plano)
   - `supabase/migrations/009_milestones_adjustments.sql` (metas + ajustes)
3. **Auth → Providers** → **desligar "Confirm email"** (v1).
4. `.env.local` já tem `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅.
5. Rodar o app, **criar sua conta** (signup) → pegar o **uuid** em Auth → Users.
6. **SQL Editor** → `supabase/migrations/002_backfill_pilot.sql` trocando `:PILOT_USER_ID` pelo uuid.

## Fase B — Conteúdo / Seed (desbloqueia 005, 008 reais)

7. Definir no ambiente: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `PILOT_USER_ID`.
8. `npm run seed` → popula a biblioteca (54 exercícios) e as 5 escadas (idempotente — rode 2×).
9. `npm run seed:program` → cria o programa-modelo (a partir do PLAN) e o marca **ativo** no piloto.
10. **Revisão por coach real** do conteúdo curado (checklist em `supabase/seeds/README.md`) e dos
    6 templates (`supabase/seeds/templates.ts`) — julgamento de domínio/segurança.
11. (opcional v1) `demoUrl` dos exercícios (hoje null).

## Fase C — IA (desbloqueia 008/009 com IA)

12. `OPENAI_API_KEY` (+ `OPENAI_MODEL`) no `.env.local` e no Vercel. Sem ela, a geração de plano usa
    o **fallback determinístico** (templates) e o coach usa só as regras — tudo funciona, só sem a
    camada de linguagem natural.
13. **Revisão jurídica** do disclaimer PAR-Q (`src/lib/anamnese.ts` → `parqDisclaimer`).

## Fase D — Monetização (010, opcional para ir ao ar)

14. `npm i stripe`.
15. Conta Stripe + produtos/preços (mensal/anual) → `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL`.
16. Envs: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL` (local + Vercel).
17. `supabase/migrations/010_subscriptions.sql` no SQL Editor.
18. Registrar webhook (`/api/stripe/webhook`) + ativar **Customer Portal** no Stripe.
19. Definir a **política de preço** (produto).

## Fase E — Deploy (Vercel)

20. Env vars de Production no Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
    `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_*` (opcional), `STRIPE_*` (se Fase D), `NEXT_PUBLIC_APP_URL`.
21. `git push` → redeploy.

## Fase F — Testes ao vivo (fecham os CAs)

22. **002**: login → seus dados aparecem; 2ª conta → isolamento por RLS.
23. **004**: trocar o programa ativo → Treinar/Início/Plano/Progressão refletem; player sem regressão.
24. **006**: montar rotina → ativar → treinar → salvar; sessão avulsa → salvar; conferir histórico.
25. **007/008**: anamnese (3 arquétipos) → geração → player; revisão clínica do plano gerado.
26. **009**: histórico → ajuste sugerido → aplicar muda o programa; bater milestone → loop de objetivo.
27. **010**: free → upgrade → pro → cancelar (Stripe CLI `stripe listen`, cartões de teste,
    webhook duplicado, pagamento falho).

---

### Atalho mínimo para "ver tudo funcionando" no local
Fases **A (1–6)** + **B (7–9)**. Com isso: contas, plano-como-dado, biblioteca, builder e anamnese
rodam ao vivo. IA (C) e Stripe (D) são incrementais por cima.
