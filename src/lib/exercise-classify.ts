// Classificação de MOVIMENTO — Estático × Dinâmico (spec 013, §3.3).
//
// POR QUÊ: hoje o player decide o modo (cronômetro de hold × contador de séries)
// por `isSkill`, o que mistura DOIS eixos distintos — o *papel* (skill × força)
// e a *medição* (hold em segundos × repetições). Isso erra com isométricos
// NÃO-skill (hollow hold, prancha, core): caem no contador de séries quando
// deveriam abrir o cronômetro de hold, perdendo o registro do tempo.
//
// Este módulo isola o eixo de MEDIÇÃO derivando-o da unidade-alvo já existente
// (`seconds` = estático/hold; `reps` = dinâmico). É PURO: sem IO, sem React,
// sem dependências de runtime — testável offline (RNF-002). A unidade efetiva
// vem do dado mais específico disponível em cada contexto (sessão > plano >
// catálogo), com fallback para a heurística atual (`isSkill`) quando a unidade
// estiver ausente/desconhecida — assim não há regressão para FL/Planche (§3.6).

/** Eixo de movimento: estático (hold/segundos) × dinâmico (reps). */
export type MovementType = "static" | "dynamic";

/**
 * Entrada mínima para classificar — aceita exercício de QUALQUER camada:
 * - `unit`        → unidade-alvo da sessão/plano (`day_exercises.target_unit`, `TemplateSlot.unit`);
 * - `targetUnit`  → alias quando a camada nomeia o campo assim;
 * - `defaultUnit` → padrão do catálogo (`ExerciseOption.defaultUnit`);
 * - `isSkill`     → heurística de fallback (isométrico de skill = hold).
 * Todos opcionais para que o helper funcione com objetos parciais.
 */
export interface ClassifiableExercise {
  unit?: string | null;
  targetUnit?: string | null;
  defaultUnit?: string | null;
  isSkill?: boolean;
}

/**
 * `true` quando o exercício é ESTÁTICO (hold cronometrado em segundos).
 *
 * Regra (spec §3.3): a unidade EFETIVA é a primeira definida na ordem de
 * especificidade `unit ?? targetUnit ?? defaultUnit` (sessão/plano antes do
 * padrão do catálogo). A partir dela:
 *   - "seconds" → static (hold);
 *   - "reps"    → dynamic;
 *   - ausente/desconhecida → fallback para `isSkill` (true => static),
 *     preservando o comportamento de FL/Planche sem exigir migração de dados.
 */
export function isStatic(ex: ClassifiableExercise): boolean {
  // Unidade efetiva: usa `??` para respeitar a ordem de precedência e não
  // sobrescrever um valor mais específico por um padrão genérico do catálogo.
  const effectiveUnit = ex.unit ?? ex.targetUnit ?? ex.defaultUnit;
  // Normaliza (trim + lowercase) para tolerar variações de seed/banco.
  const u = effectiveUnit?.trim().toLowerCase();

  if (u === "seconds") return true; // hold cronometrado
  if (u === "reps") return false; // contador de séries/reps

  // Unidade ausente ou desconhecida → cai na heurística atual (isSkill).
  // `!!` para tratar undefined como dinâmico (sem regressão para força/reps).
  return !!ex.isSkill;
}

/** Wrapper de `isStatic` que devolve o `MovementType` para drivers/rótulos. */
export function movementType(ex: ClassifiableExercise): MovementType {
  return isStatic(ex) ? "static" : "dynamic";
}

/** Rótulos pt-BR (caixa-alta, padrão dos chips/labels do design system). */
export const MOVEMENT_LABELS = {
  static: "ESTÁTICO",
  dynamic: "DINÂMICO",
} as const;
