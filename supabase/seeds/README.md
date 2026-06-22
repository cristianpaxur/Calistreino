# Conteúdo curado — Biblioteca & Escadas (005)

Este diretório contém o **conteúdo curado** do CalisTreino: o catálogo de
exercícios e as escadas de progressão dos skills. É o backbone que a IA (008)
configura e que o builder manual (006) usa. **A IA só escolhe daqui — não inventa
exercício.**

## Arquivos

| Arquivo | Papel |
|---------|-------|
| `types.ts` | Tipos do seed (`SeedExercise`, `SeedSkill`, ...). Espelham as tabelas da migração 003 no shape de seed (sempre global). |
| `exercises.ts` | Catálogo de exercícios (`EXERCISES`). ≥ 40 itens, push/pull/pernas/core + isométricos. |
| `skills.ts` | Escadas de progressão (`SKILLS`). 5 skills, cada nível amarrado a um exercício por `slug`. |

Inserção no banco: `scripts/seed.ts` (idempotente). Validação offline:
`scripts/verify-content.ts`.

## Como rodar

```bash
# 1. Validação offline (sem rede) — formato, slugs, escadas amarradas ao catálogo
npm run verify:content

# 2. Aplicar no Supabase (PORTÃO HUMANO — precisa das chaves; rode 2× p/ idempotência)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed
```

> Os scripts `.ts` rodam direto no Node (v23+) por type-stripping nativo — sem
> build intermediário. O seed usa `service_role` por ser um script **admin
> one-off fora do front-end**; o runtime do app **nunca** usa service_role (R2).

## Como expandir

### Adicionar um exercício
1. Acrescente um objeto a `EXERCISES` em `exercises.ts`.
2. `slug` em **kebab-case**, único e **estável** (é a chave de idempotência do
   seed — não renomeie depois de publicado).
3. Preencha **todos** os campos obrigatórios: `name`, `category`, `pattern`,
   `equipment`, `cues`. Marque `isSkill: true` e `defaultUnit: "seconds"` em
   isométricos.
4. Rode `npm run verify:content` e depois `npm run seed`.

### Adicionar/editar uma escada
1. Acrescente um objeto a `SKILLS` em `skills.ts`.
2. `levels` é uma lista **ordenada** (índice 0 = regressão mais fácil; último =
   a meta). **Toda meta precisa de regressão antes dela.**
3. Cada `exerciseSlug` deve existir em `exercises.ts` (o validador reprova se não).
4. Rode `npm run verify:content` e depois `npm run seed`.

A posição de cada nível no banco vem do **índice no array** — reordenar o array
reordena a escada.

## Checklist de segurança (T-003 / RNF-001)

Conteúdo de treino é responsabilidade de produto, não só técnica. Antes de
liberar em produção, **um coach de calistenia deve validar** este checklist.
Marque cada item ao revisar:

- [ ] Toda escada tem **regressão antes da meta** (nenhum skill começa no nível final).
- [ ] A progressão entre níveis é **conservadora** (sem saltos grandes de carga/alavanca).
- [ ] Todo exercício tem **cue de forma/segurança** preenchido.
- [ ] Isométricos de skill (FL/planche/handstand) reforçam **prehab de cotovelo/punho**
      e **progressão lenta de alavanca**.
- [ ] Exercícios de **core/lombar** seguem coluna neutra (anti-extensão, McGill),
      sem flexão de coluna sob fadiga (alinhado a `LOWER_BACK_FLAGS` em `src/lib/plan.ts`).
- [ ] **Pernas** (nórdico/pistol) com progressão amiga do joelho.
- [ ] Nada perigoso/inventado: cada item é um movimento reconhecido e seguro para
      o nível-alvo.

> **Portão humano:** esta revisão de segurança e a curadoria de `demoUrl`
> (vídeos/GIFs — `null` aceito em v1) são aprovação humana. O código aqui apenas
> entrega o conteúdo e o seed idempotente; **não** marque o conteúdo como
> aprovado sem a revisão do coach.
