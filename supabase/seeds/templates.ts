// Templates de programa (008 / T-001). Esqueletos VALIDADOS por arquétipo/skill
// que a IA apenas CONFIGURA (não inventa) e o fallback determinístico parametriza.
//
// Princípio do produto: "IA configura, não inventa". Cada template descreve dias
// com slots de exercício referenciando SLUGS da biblioteca curada (005 /
// supabase/seeds/exercises.ts) — nunca nomes livres. Os slots trazem alternativas
// por equipamento e regressões por lesão, para que a parametrização (perfil) e o
// validador (plan-validator) mantenham o plano dentro dos limites de segurança.
//
// PURO: nenhum IO. Consumido por src/lib/plan-generator.ts (offline) e pelo
// script de verificação scripts/verify-plan.ts. Os slugs são validados contra o
// catálogo por `npm run verify:plan`.

import type { SeedUnit } from "./types.ts";

export type TemplateArchetype = "skill" | "strength" | "health";

/** Um slot de exercício dentro de um dia do template. O slug primário é a
 *  escolha padrão; `alts` são substituições equivalentes por equipamento/lesão.
 *  O slot NÃO carrega prescrição numérica fixa: o gerador a deriva do perfil
 *  (volume/tempo) dentro dos tetos do validador. */
export interface TemplateSlot {
  /** Slug primário (deve existir em exercises.ts). */
  slug: string;
  /** true => isométrico de skill (prescrição em segundos/holds). */
  isSkill?: boolean;
  /** Unidade-alvo. Default 'reps' (ou 'seconds' se isSkill). */
  unit?: SeedUnit;
  /** Faixa de séries sugerida (o gerador escolhe dentro dela pela frequência). */
  sets?: [number, number];
  /** Faixa de reps (não-skill) ou segundos por hold (skill). */
  target?: [number, number];
  /** Descanso sugerido em segundos. */
  restSeconds?: number;
  /** Alternativas equivalentes (mesmo padrão) por equipamento ausente. Ordem =
   *  preferência. O gerador troca o slug quando o equipamento do primário falta. */
  alts?: string[];
  /** Regressões mais fáceis (PAR-Q warn/block ou iniciante). Ordem = mais fácil. */
  regressions?: string[];
  /** Equipamento necessário para o slug primário (subconjunto de SeedEquipment).
   *  Vazio/ausente => só peso do corpo. */
  needsEquipment?: string[];
  /** Slot opcional: pode ser podado quando a sessão é curta / poucos dias. */
  optional?: boolean;
  /** Marca o slot como o exercício-foco da skill alvo (caminho skill). */
  isFocus?: boolean;
}

export interface TemplateDay {
  code: string; // D1..D5
  title: string;
  focus: string;
  /** intensidade / volume / recuperação (espelha PlanDay.character). */
  character: string;
  slots: TemplateSlot[];
}

export interface ProgramTemplate {
  /** Identidade estável do template. */
  id: string;
  name: string;
  archetype: TemplateArchetype;
  /** Quando archetype=skill, o slug da skill alvo (front-lever, planche…). */
  goalSkill?: string;
  /** Número de ciclos/semanas sugerido. */
  cycleWeeks: number;
  /** Dias do template na ordem base (frequência alta). O gerador poda para a
   *  disponibilidade do usuário (2–5 dias). */
  days: TemplateDay[];
  /** Texto curto de descrição (UI de revisão). */
  blurb: string;
}

// ── Blocos reutilizáveis ─────────────────────────────────────────────
const WARM_NOTE = "Aquecimento de punho/escápula + ramp do padrão antes do trabalho.";

/** Slot de força de empurrar (push) com escalonamento por equipamento. */
const PUSH_SLOT: TemplateSlot = {
  slug: "push-up",
  unit: "reps",
  sets: [3, 4],
  target: [8, 12],
  restSeconds: 90,
  regressions: ["incline-push-up", "knee-push-up"],
  alts: ["dip", "pike-push-up"],
};

const DIP_SLOT: TemplateSlot = {
  slug: "dip",
  unit: "reps",
  sets: [3, 4],
  target: [6, 10],
  restSeconds: 120,
  needsEquipment: ["dip-bar"],
  alts: ["bench-dip"],
  regressions: ["bench-dip"],
};

const PULL_SLOT: TemplateSlot = {
  slug: "pull-up",
  unit: "reps",
  sets: [3, 4],
  target: [5, 10],
  restSeconds: 120,
  needsEquipment: ["bar"],
  regressions: ["negative-pull-up", "australian-row"],
  alts: ["australian-row"],
};

const ROW_SLOT: TemplateSlot = {
  slug: "australian-row",
  unit: "reps",
  sets: [3, 3],
  target: [10, 15],
  restSeconds: 90,
  needsEquipment: ["bar"],
  alts: ["tuck-front-lever-row"],
};

const LEGS_SLOT: TemplateSlot = {
  slug: "bodyweight-squat",
  unit: "reps",
  sets: [3, 4],
  target: [12, 20],
  restSeconds: 90,
  alts: ["split-squat", "assisted-pistol-squat"],
  regressions: ["wall-sit"],
};

const HINGE_SLOT: TemplateSlot = {
  slug: "glute-bridge",
  unit: "reps",
  sets: [3, 3],
  target: [12, 15],
  restSeconds: 60,
  alts: ["hip-thrust-single-leg", "nordic-curl"],
  optional: true,
};

const CORE_SLOT: TemplateSlot = {
  slug: "hollow-body-hold",
  isSkill: false,
  unit: "seconds",
  sets: [3, 3],
  target: [15, 30],
  restSeconds: 60,
  alts: ["plank", "dead-bug"],
  regressions: ["dead-bug", "bird-dog"],
};

const ANTI_EXT_CORE: TemplateSlot = {
  slug: "side-plank",
  unit: "seconds",
  sets: [2, 3],
  target: [20, 40],
  restSeconds: 45,
  alts: ["bird-dog", "mcgill-curl-up"],
  optional: true,
};

// ── Templates ────────────────────────────────────────────────────────

/** Slot de foco de skill: traz a escada (regressões) da skill alvo. O gerador
 *  encaixa a alavanca certa pelo benchmark do exame físico (007). */
function skillFocusSlot(
  slug: string,
  regressions: string[],
  unit: SeedUnit = "seconds"
): TemplateSlot {
  return {
    slug,
    isSkill: true,
    isFocus: true,
    unit,
    sets: [4, 5],
    target: unit === "seconds" ? [5, 10] : [3, 5],
    restSeconds: 150,
    regressions,
    needsEquipment: undefined,
  };
}

const FRONT_LEVER_TEMPLATE: ProgramTemplate = {
  id: "skill-front-lever",
  name: "Front Lever — caça à skill",
  archetype: "skill",
  goalSkill: "front-lever",
  cycleWeeks: 12,
  blurb: "Foco em holds de Front Lever na alavanca certa + puxada vertical/horizontal e core anti-extensão.",
  days: [
    {
      code: "D1",
      title: "Front Lever + Puxada (intensidade)",
      focus: "front",
      character: "Intensidade (max-hold)",
      slots: [
        skillFocusSlot("full-front-lever", [
          "front-lever-negative",
          "tuck-front-lever",
          "advanced-tuck-front-lever",
          "straddle-front-lever",
        ]),
        { ...PULL_SLOT },
        { slug: "tuck-front-lever-row", unit: "reps", sets: [3, 3], target: [6, 8], restSeconds: 120, needsEquipment: ["bar"], alts: ["australian-row"] },
        { ...CORE_SLOT },
      ],
    },
    {
      code: "D2",
      title: "Empurrar + Pernas",
      focus: "push",
      character: "Volume",
      slots: [{ ...DIP_SLOT }, { ...PUSH_SLOT }, { ...LEGS_SLOT }, { ...ANTI_EXT_CORE }],
    },
    {
      code: "D3",
      title: "Front Lever + Volume de puxada",
      focus: "front",
      character: "Volume",
      slots: [
        skillFocusSlot("straddle-front-lever", [
          "tuck-front-lever",
          "advanced-tuck-front-lever",
        ]),
        { ...ROW_SLOT },
        { ...PULL_SLOT, sets: [3, 3], target: [4, 8] },
        { ...ANTI_EXT_CORE },
      ],
    },
  ],
};

const PLANCHE_TEMPLATE: ProgramTemplate = {
  id: "skill-planche",
  name: "Planche — caça à skill",
  archetype: "skill",
  goalSkill: "planche",
  cycleWeeks: 12,
  blurb: "Lean e holds de Planche na alavanca certa, com empurrada pesada e condicionamento de punho/cotovelo.",
  days: [
    {
      code: "D1",
      title: "Planche + Empurrar (intensidade)",
      focus: "planche",
      character: "Intensidade (max-hold)",
      slots: [
        skillFocusSlot("full-planche", [
          "planche-lean",
          "tuck-planche",
          "advanced-tuck-planche",
          "straddle-planche",
        ]),
        { slug: "pseudo-planche-push-up", unit: "reps", sets: [4, 4], target: [5, 8], restSeconds: 120, alts: ["pike-push-up"] },
        { ...DIP_SLOT },
        { ...CORE_SLOT },
      ],
    },
    {
      code: "D2",
      title: "Puxar + Pernas",
      focus: "pull",
      character: "Volume",
      slots: [{ ...PULL_SLOT }, { ...ROW_SLOT }, { ...LEGS_SLOT }, { ...ANTI_EXT_CORE }],
    },
    {
      code: "D3",
      title: "Planche + Empurrar (volume)",
      focus: "planche",
      character: "Volume",
      slots: [
        skillFocusSlot("straddle-planche", ["tuck-planche", "advanced-tuck-planche"]),
        { ...PUSH_SLOT },
        { slug: "pike-push-up", unit: "reps", sets: [3, 3], target: [6, 10], restSeconds: 90, alts: ["wall-handstand-push-up"] },
        { ...CORE_SLOT },
      ],
    },
  ],
};

const HANDSTAND_TEMPLATE: ProgramTemplate = {
  id: "skill-handstand",
  name: "Parada de mão — caça à skill",
  archetype: "skill",
  goalSkill: "handstand",
  cycleWeeks: 12,
  blurb: "Alinhamento e holds de parada de mão (parede → livre) + empurrada vertical e core.",
  days: [
    {
      code: "D1",
      title: "Parada de mão + Empurrar",
      focus: "handstand",
      character: "Técnica + intensidade",
      slots: [
        skillFocusSlot("freestanding-handstand", [
          "wall-plank-hold",
          "chest-to-wall-handstand",
          "back-to-wall-handstand",
        ]),
        { slug: "pike-push-up", unit: "reps", sets: [4, 4], target: [6, 10], restSeconds: 90, alts: ["wall-handstand-push-up"] },
        { ...DIP_SLOT },
        { ...CORE_SLOT },
      ],
    },
    {
      code: "D2",
      title: "Puxar + Pernas",
      focus: "pull",
      character: "Volume",
      slots: [{ ...PULL_SLOT }, { ...ROW_SLOT }, { ...LEGS_SLOT }, { ...ANTI_EXT_CORE }],
    },
    {
      code: "D3",
      title: "Parada de mão + Core",
      focus: "handstand",
      character: "Volume",
      slots: [
        skillFocusSlot("back-to-wall-handstand", ["wall-plank-hold", "chest-to-wall-handstand"]),
        { slug: "wall-handstand-push-up", unit: "reps", sets: [3, 3], target: [3, 6], restSeconds: 120, needsEquipment: ["wall"], regressions: ["pike-push-up"] },
        { ...CORE_SLOT },
        { ...ANTI_EXT_CORE },
      ],
    },
  ],
};

const MUSCLE_UP_TEMPLATE: ProgramTemplate = {
  id: "skill-muscle-up",
  name: "Muscle-up — caça à skill",
  archetype: "skill",
  goalSkill: "muscle-up",
  cycleWeeks: 12,
  blurb: "Pull-up explosivo, dip na barra reta e negativas de transição para destravar o muscle-up.",
  days: [
    {
      code: "D1",
      title: "Puxada explosiva + Transição",
      focus: "muscle-up",
      character: "Intensidade",
      slots: [
        skillFocusSlot("muscle-up", [
          "high-pull-up",
          "straight-bar-dip",
          "muscle-up-transition-negative",
        ], "reps"),
        { slug: "high-pull-up", unit: "reps", sets: [4, 5], target: [3, 6], restSeconds: 150, needsEquipment: ["bar"], regressions: ["pull-up", "negative-pull-up"] },
        { slug: "straight-bar-dip", unit: "reps", sets: [3, 4], target: [5, 10], restSeconds: 120, needsEquipment: ["bar"], alts: ["dip", "bench-dip"] },
        { ...CORE_SLOT },
      ],
    },
    {
      code: "D2",
      title: "Empurrar + Pernas",
      focus: "push",
      character: "Volume",
      slots: [{ ...DIP_SLOT }, { ...PUSH_SLOT }, { ...LEGS_SLOT }, { ...ANTI_EXT_CORE }],
    },
    {
      code: "D3",
      title: "Volume de puxada",
      focus: "pull",
      character: "Volume",
      slots: [
        { ...PULL_SLOT },
        { ...ROW_SLOT },
        { slug: "muscle-up-transition-negative", isSkill: true, unit: "seconds", sets: [3, 4], target: [3, 5], restSeconds: 120, needsEquipment: ["bar"], regressions: ["straight-bar-dip"] },
        { ...CORE_SLOT },
      ],
    },
  ],
};

const STRENGTH_TEMPLATE: ProgramTemplate = {
  id: "general-strength",
  name: "Força geral em calistenia",
  archetype: "strength",
  cycleWeeks: 8,
  blurb: "Empurrar / puxar / pernas / core equilibrados, com progressão por reps e holds.",
  days: [
    {
      code: "D1",
      title: "Empurrar",
      focus: "push",
      character: "Intensidade",
      slots: [{ ...DIP_SLOT }, { ...PUSH_SLOT }, { slug: "pike-push-up", unit: "reps", sets: [3, 3], target: [6, 10], restSeconds: 90, alts: ["wall-handstand-push-up"] }, { ...CORE_SLOT }],
    },
    {
      code: "D2",
      title: "Puxar",
      focus: "pull",
      character: "Intensidade",
      slots: [{ ...PULL_SLOT }, { ...ROW_SLOT }, { slug: "scapular-pull", unit: "reps", sets: [3, 3], target: [8, 12], restSeconds: 60, needsEquipment: ["bar"], alts: ["dead-hang"] }, { ...ANTI_EXT_CORE }],
    },
    {
      code: "D3",
      title: "Pernas + Core",
      focus: "legs",
      character: "Volume",
      slots: [{ ...LEGS_SLOT }, { ...HINGE_SLOT }, { slug: "calf-raise", unit: "reps", sets: [3, 3], target: [12, 20], restSeconds: 45, optional: true }, { ...CORE_SLOT }],
    },
  ],
};

const HEALTH_TEMPLATE: ProgramTemplate = {
  id: "general-health",
  name: "Saúde, movimento & consistência",
  archetype: "health",
  cycleWeeks: 6,
  blurb: "Padrões fundamentais com baixo risco, foco em coluna neutra, mobilidade e constância.",
  days: [
    {
      code: "D1",
      title: "Corpo inteiro A",
      focus: "fullbody",
      character: "Volume moderado",
      slots: [
        { ...PUSH_SLOT, sets: [2, 3], target: [6, 12] },
        { ...ROW_SLOT, sets: [2, 3], target: [8, 12], regressions: ["bird-dog"] },
        { ...LEGS_SLOT, sets: [2, 3], target: [10, 15] },
        { slug: "mcgill-curl-up", unit: "reps", sets: [2, 3], target: [6, 10], restSeconds: 45, alts: ["dead-bug"] },
      ],
    },
    {
      code: "D2",
      title: "Corpo inteiro B",
      focus: "fullbody",
      character: "Volume moderado",
      slots: [
        { ...PUSH_SLOT, sets: [2, 3], target: [6, 12], regressions: ["incline-push-up", "knee-push-up"] },
        { ...HINGE_SLOT, optional: false, sets: [2, 3] },
        { slug: "bird-dog", unit: "reps", sets: [2, 3], target: [8, 10], restSeconds: 45 },
        { ...ANTI_EXT_CORE, optional: false },
      ],
    },
  ],
};

export const TEMPLATES: ProgramTemplate[] = [
  FRONT_LEVER_TEMPLATE,
  PLANCHE_TEMPLATE,
  HANDSTAND_TEMPLATE,
  MUSCLE_UP_TEMPLATE,
  STRENGTH_TEMPLATE,
  HEALTH_TEMPLATE,
];

/** Seleção determinística do template (RF-001): por skill alvo quando o
 *  arquétipo é "skill"; senão pelo arquétipo. Cai no força geral se nada casar. */
export function selectTemplate(
  archetype: TemplateArchetype | string | null,
  goalSkill?: string | null
): ProgramTemplate {
  if (archetype === "skill" && goalSkill) {
    const bySkill = TEMPLATES.find((t) => t.archetype === "skill" && t.goalSkill === goalSkill);
    if (bySkill) return bySkill;
  }
  const byArch = TEMPLATES.find((t) => t.archetype === archetype && t.archetype !== "skill");
  if (byArch) return byArch;
  // skill sem template específico → cai no força geral (seguro).
  return STRENGTH_TEMPLATE;
}

export { WARM_NOTE };
