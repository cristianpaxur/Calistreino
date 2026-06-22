// Tipos do conteúdo curado (005). Espelham as tabelas exercise_library /
// skills / skill_levels da migração 003, mas no shape de SEED (sem id/created_at;
// owner_user_id é sempre null = global).
//
// Estes tipos são consumidos por:
//   • supabase/seeds/exercises.ts  (catálogo)
//   • supabase/seeds/skills.ts     (escadas)
//   • scripts/seed.ts              (upsert idempotente por slug — portão humano)
//   • scripts/verify-content.ts    (validação offline do formato)
//
// PURO: nenhum IO aqui. A inserção real fica em scripts/seed.ts.

/** Unidade-alvo de uma prescrição: repetições ou segundos (isométricos). */
export type SeedUnit = "reps" | "seconds";

/** Categoria macro do exercício. */
export type SeedCategory = "skill" | "forca" | "core" | "pernas";

/**
 * Padrão de movimento. Inclui os padrões básicos de força + os "trilhos" de
 * skill usados pelas escadas (front/planche/handstand/muscle-up/pistol...).
 */
export type SeedPattern =
  | "push"
  | "pull"
  | "legs"
  | "core"
  | "front"
  | "planche"
  | "handstand"
  | "muscle-up"
  | "pistol"
  | "flag"
  | "back-lever";

/** Equipamento necessário. '{}' (vazio) = só peso do corpo / chão. */
export type SeedEquipment =
  | "bar"
  | "rings"
  | "parallettes"
  | "dip-bar"
  | "wall"
  | "floor"
  | "band"
  | "bench";

/** Um exercício curado da biblioteca (linha global de exercise_library). */
export interface SeedExercise {
  /** Identidade estável e única (escopo global). NÃO mude depois de publicado. */
  slug: string;
  name: string;
  category: SeedCategory;
  pattern: SeedPattern;
  /** true => isométrico de skill (mede max-hold). */
  isSkill?: boolean;
  /** Unidade-alvo padrão. Default 'reps'. */
  defaultUnit?: SeedUnit;
  equipment: SeedEquipment[];
  /** Cue técnico curto (segurança/forma). Obrigatório (RNF-001). */
  cues: string;
  /** URL de vídeo/GIF (v1: opcional, placeholder/null aceito — RNF-002). */
  demoUrl?: string | null;
}

/**
 * Uma escada de progressão de skill. Cada nível referencia um exercício da
 * biblioteca por slug (`exerciseSlug`) — é assim que a escada amarra ao catálogo.
 */
export interface SeedSkillLevel {
  /** Nome do nível na escada (ex.: "Tuck", "Advanced tuck", "Full"). */
  name: string;
  /** Slug do exercício-chave deste nível (deve existir em exercises.ts). */
  exerciseSlug: string;
}

export interface SeedSkill {
  /** Identidade estável e única (escopo global). */
  slug: string;
  name: string;
  /** Níveis ORDENADOS: índice 0 = regressão mais fácil; último = a meta. */
  levels: SeedSkillLevel[];
}
