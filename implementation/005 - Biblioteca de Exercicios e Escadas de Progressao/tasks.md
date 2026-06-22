# Tarefas: Biblioteca de Exercícios e Escadas de Progressão

> **Implementação:** 005 - Biblioteca de Exercícios e Escadas de Progressão
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 4/7 tarefas de código concluídas (3 restantes são portões humanos)
> **Última atualização:** 2026-06-22

---

## Legenda
- `[ ]` Pendente · `[x]` Concluída · `[!]` Bloqueada · `[-]` Cancelada

---

## Tarefas

### Fase 1: Conteúdo

- [x] **T-001:** Catálogo de exercícios básicos
  - **Descrição:** ≥ 40 exercícios (push/pull/pernas/core + isométricos) com categoria, padrão, equipamento, unidade-alvo, cue.
  - **Arquivos envolvidos:** `supabase/seeds/types.ts`, `supabase/seeds/exercises.ts`
  - **Critério de conclusão:** Lista completa e revisada. → **54 exercícios** escritos; `verify:content` verde.
  - **Dependências:** Nenhuma
  - **Estimativa:** Grande

- [x] **T-002:** Escadas dos skills prioritários
  - **Descrição:** FL, Planche, Handstand, Muscle-up, Pistol — níveis ordenados (regressão→meta), ligados a exercícios.
  - **Arquivos envolvidos:** `supabase/seeds/skills.ts`
  - **Critério de conclusão:** 5 escadas completas. → **5 escadas** com níveis amarrados a `exerciseSlug` do catálogo; validado por `verify:content`.
  - **Dependências:** T-001
  - **Estimativa:** Grande

- [!] **T-003:** Revisão de segurança do conteúdo — **PORTÃO HUMANO**
  - **Descrição:** Checklist (regressões, prehab de articulação, progressão conservadora) idealmente validado por coach.
  - **Arquivos envolvidos:** `supabase/seeds/README.md` (checklist escrito), `supabase/seeds/*`
  - **Critério de conclusão:** Checklist aprovado. → Checklist **escrito** em `README.md`; aprovação por coach real é ação humana.
  - **Dependências:** T-002
  - **Estimativa:** Média

### Fase 2: Seed

- [x] **T-004:** Script de seed idempotente
  - **Descrição:** `scripts/seed.ts` que faz upsert por `slug` em biblioteca/escadas.
  - **Arquivos envolvidos:** `scripts/seed.ts`, `scripts/tsconfig.json`, `scripts/verify-content.ts`, `package.json`
  - **Critério de conclusão:** Roda 2× sem duplicar. → Upsert buscar→inserir/atualizar por slug global (exercícios) e por `(skill_id, position)` (níveis). Executar ao vivo é T-005 (portão humano).
  - **Dependências:** T-001, T-002
  - **Estimativa:** Média

- [!] **T-005:** Aplicar seed no Supabase — **PORTÃO HUMANO**
  - **Descrição:** Executar o seed no projeto.
  - **Arquivos envolvidos:** —
  - **Critério de conclusão:** Dados presentes no banco. → Requer 003 aplicada + `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`; rodar `npm run seed` 2× (idempotência).
  - **Dependências:** T-004
  - **Estimativa:** Pequena

### Fase 3: Validação

- [~] **T-006:** Consultas de validação
  - **Descrição:** Filtrar por equipamento/padrão; ler uma escada completa ordenada.
  - **Arquivos envolvidos:** `scripts/verify-content.ts`
  - **Critério de conclusão:** Consultas retornam o esperado. → Validação **offline** (filtro por equipamento/padrão + escada ordenada) coberta por `verify:content`. Consulta ao vivo no Supabase depende de T-005 (portão humano).
  - **Dependências:** T-005
  - **Estimativa:** Pequena

- [x] **T-007:** Documentar formato e como expandir
  - **Descrição:** Doc curta de como adicionar exercícios/skills ao seed.
  - **Arquivos envolvidos:** `supabase/seeds/README.md`
  - **Critério de conclusão:** Guia de expansão escrito. → `README.md` com arquivos, como rodar, como expandir e checklist de segurança.
  - **Dependências:** T-004
  - **Estimativa:** Pequena

---

## Registro de Progresso

| Tarefa | Status | Data | Observações |
|--------|--------|------|-------------|
| T-001 | ✅ Concluída | 2026-06-22 | 54 exercícios em `seeds/exercises.ts` + `types.ts`. |
| T-002 | ✅ Concluída | 2026-06-22 | 5 escadas em `seeds/skills.ts`, níveis amarrados ao catálogo. |
| T-003 | 🔒 Portão humano | 2026-06-22 | Checklist escrito em `README.md`; aprovação por coach pendente. |
| T-004 | ✅ Concluída | 2026-06-22 | `scripts/seed.ts` idempotente por slug + `verify-content.ts`. |
| T-005 | 🔒 Portão humano | 2026-06-22 | Rodar `npm run seed` 2× contra Supabase real (precisa de chaves + 003 aplicada). |
| T-006 | 🟡 Parcial | 2026-06-22 | Filtro/escada validados offline; consulta ao vivo depende de T-005. |
| T-007 | ✅ Concluída | 2026-06-22 | `supabase/seeds/README.md` (formato + expansão + segurança). |

### Portões humanos registrados
- **T-003:** revisão e aprovação de segurança do conteúdo por coach de calistenia (checklist em `README.md`).
- **T-005:** aplicar 003 no Supabase + `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`; rodar `npm run seed` 2× (idempotência, CA-002).
- Curadoria de `demoUrl` (vídeos/GIFs) — `null` aceito em v1 (RNF-002).
