// JSON Schema do plano (008 / T-002) para OpenAI structured outputs.
//
// Força a IA a devolver EXATAMENTE o shape de um ProgramDraft (003): programa →
// dias → exercícios, com `slug` restrito (enum) à biblioteca curada (005). Isso
// é metade da rede de segurança (a outra metade é plan-validator): a IA não pode
// inventar exercícios porque o schema só aceita slugs conhecidos.
//
// PURO (sem IO). `buildPlanSchema(slugs)` recebe os slugs permitidos e devolve o
// objeto `response_format` json_schema (strict) que `ai.ts::generatePlanWithAI`
// passa ao OpenAI. Também mapeia a saída validada → ProgramDraft.

import type { ProgramDraft } from "./program-types.ts";

/** Shape que a IA devolve (1:1 com o json_schema). */
export interface AiPlanExercise {
  slug: string;
  is_skill: boolean;
  target_unit: "reps" | "seconds";
  sets: number;
  target_min: number;
  target_max: number;
  rest_seconds: number;
  note?: string;
}
export interface AiPlanDay {
  code: string;
  title: string;
  focus: string;
  character: string;
  exercises: AiPlanExercise[];
}
export interface AiPlan {
  name: string;
  archetype: string;
  cycle_weeks: number;
  days: AiPlanDay[];
}

/** Constrói o objeto `response_format` (json_schema strict) para a API. O enum de
 *  `slug` é a lista de slugs permitidos — a IA não consegue emitir outro valor. */
export function buildPlanSchema(allowedSlugs: string[]): Record<string, unknown> {
  // strict mode exige enum não-vazio; garantimos ao menos um placeholder.
  const slugEnum = allowedSlugs.length ? allowedSlugs : ["push-up"];
  return {
    type: "json_schema",
    json_schema: {
      name: "training_plan",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["name", "archetype", "cycle_weeks", "days"],
        properties: {
          name: { type: "string" },
          archetype: { type: "string" },
          cycle_weeks: { type: "integer", minimum: 1, maximum: 24 },
          days: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["code", "title", "focus", "character", "exercises"],
              properties: {
                code: { type: "string" },
                title: { type: "string" },
                focus: { type: "string" },
                character: { type: "string" },
                exercises: {
                  type: "array",
                  minItems: 1,
                  maxItems: 8,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "slug",
                      "is_skill",
                      "target_unit",
                      "sets",
                      "target_min",
                      "target_max",
                      "rest_seconds",
                    ],
                    properties: {
                      slug: { type: "string", enum: slugEnum },
                      is_skill: { type: "boolean" },
                      target_unit: { type: "string", enum: ["reps", "seconds"] },
                      sets: { type: "integer", minimum: 1, maximum: 8 },
                      target_min: { type: "integer", minimum: 0, maximum: 60 },
                      target_max: { type: "integer", minimum: 1, maximum: 60 },
                      rest_seconds: { type: "integer", minimum: 0, maximum: 300 },
                      note: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

/** Monta a prescrição textual ("4 × 8-12" / "5 × 5-9s") a partir dos campos. */
export function formatPrescription(ex: AiPlanExercise): string {
  const unit = ex.target_unit === "seconds" ? "s" : "";
  const range =
    ex.target_min === ex.target_max
      ? `${ex.target_max}${unit}`
      : `${ex.target_min}-${ex.target_max}${unit}`;
  return `${ex.sets} × ${range}`;
}

/** Mapeia o AiPlan (validado contra o schema) → ProgramDraft (003), resolvendo
 *  slug → exercise_id pela tabela fornecida. Slugs sem id viram nome livre
 *  (fallback) preservando o slug em `slug` extra para o validador. */
export function aiPlanToDraft(
  plan: AiPlan,
  resolve: (slug: string) => { id: string | null; name: string } | null
): ProgramDraft {
  return {
    name: plan.name,
    archetype: plan.archetype,
    source: "ai",
    cycle_weeks: plan.cycle_weeks,
    days: plan.days.map((d, di) => ({
      code: d.code || `D${di + 1}`,
      title: d.title,
      focus: d.focus,
      character: d.character,
      position: di,
      exercises: d.exercises.map((ex, ei) => {
        const lib = resolve(ex.slug);
        return {
          exercise_id: lib?.id ?? null,
          exercise_name: lib?.name ?? ex.slug,
          is_skill: ex.is_skill,
          prescription: formatPrescription(ex),
          target_unit: ex.target_unit,
          target_min: ex.target_min,
          target_max: ex.target_max,
          rest_seconds: ex.rest_seconds,
          position: ei,
          note: ex.note ?? null,
          // slug preservado p/ o validador (checagem de biblioteca/equipamento).
          slug: ex.slug,
        } as ProgramDraft["days"][number]["exercises"][number] & { slug: string };
      }),
    })),
  };
}
