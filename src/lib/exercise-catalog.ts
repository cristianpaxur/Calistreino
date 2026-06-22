// Catálogo de exercícios para o ExercisePicker (006). Função PURA (sem IO) que
// deriva uma lista de "opções de exercício" a partir da semente PLAN, usada como
// FALLBACK offline quando a biblioteca (005) ainda não foi semeada no banco.
//
// O picker real (server) tenta `listLibrary()` primeiro; se vier vazio ou falhar
// (migração 003/005 não aplicada — R1/R9), cai nestas opções derivadas do PLAN.
// Assim o builder e a sessão avulsa funcionam HOJE, sem credenciais.

import { PLAN, type Category } from "./plan.ts";

export interface ExerciseOption {
  /** id da biblioteca (003) quando vem do banco; null quando derivado do PLAN. */
  id: string | null;
  slug: string | null;
  name: string;
  category: Category;
  isSkill: boolean;
  /** unidade-alvo padrão: "seconds" p/ skills isométricos, senão "reps". */
  defaultUnit: "reps" | "seconds";
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Opções derivadas do PLAN (dedupe por nome). Pura — testável offline. */
export function seedExerciseOptions(): ExerciseOption[] {
  const byName = new Map<string, ExerciseOption>();
  for (const day of PLAN) {
    for (const ex of day.exercises) {
      const key = ex.name.toLowerCase().trim();
      if (byName.has(key)) continue;
      const isSkill = !!ex.isSkill;
      byName.set(key, {
        id: null,
        slug: slugify(ex.name),
        name: ex.name,
        category: ex.category as Category,
        isSkill,
        defaultUnit: isSkill ? "seconds" : "reps",
      });
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "pt"));
}

/** Filtro local por texto (nome) — usado no client e testável. */
export function filterOptions(
  options: ExerciseOption[],
  query: string
): ExerciseOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => o.name.toLowerCase().includes(q));
}
