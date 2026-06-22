// Plano de Retorno e Progressão — Front Lever + Planche
// Dados extraídos do PDF do usuário. Usados como referência/template do treino.

export type Category = "skill" | "forca" | "core" | "pernas";

export interface PlanExercise {
  name: string;
  category: Category;
  prescription: string; // texto prescrito (séries × tempo/reps)
  note?: string;
  /** true => exercício isométrico de skill com alavanca + max-hold (FL/Planche) */
  isSkill?: boolean;
}

export interface PlanDay {
  code: string; // D1..D5
  weekday: string; // Seg, Ter...
  title: string;
  focus: string;
  character: string; // intensidade / volume / recuperação
  exercises: PlanExercise[];
}

export interface CycleWeek {
  weeks: string; // "1", "2-5"...
  block: string;
  what: string;
}

export const WARMUP = {
  durationMin: "8-10 min",
  items: [
    "Punhos/cotovelo: círculos de punho na paralela, flexão de punho leve, 2×10 cada.",
    "Escápula: scap pulls 2×10 (dias de puxada) ou scap push-ups 2×10 (dias de empurrada).",
    "Lombar (prehab + ativação): bird dog 2×8/lado, dead bug 2×8/lado.",
    "Ramp do skill: 2 holds curtos numa alavanca mais fácil que o trabalho.",
  ],
};

export const PLAN: PlanDay[] = [
  {
    code: "D1",
    weekday: "Seg",
    title: "Front Lever + Puxada",
    focus: "Front Lever + Puxada",
    character: "Intensidade (max-hold)",
    exercises: [
      {
        name: "Front Lever — max hold",
        category: "skill",
        isSkill: true,
        prescription: "5 × 5-9s na alavanca + FL 3×3",
        note: "Descanso 2-3 min. Alavanca mais difícil que segura limpa.",
      },
      {
        name: "FL negativas (controladas)",
        category: "skill",
        isSkill: true,
        prescription: "3 × 3 — descida 4-5s de tuck/inverted hang até FL",
        note: "Descanso 2 min.",
      },
      {
        name: "Pull-ups (subida explosiva, descida 2s)",
        category: "forca",
        prescription: "4 × 6-10 · RIR 1-2",
      },
      {
        name: "Tuck / Advanced tuck FL rows",
        category: "forca",
        prescription: "3 × 6-8",
        note: "Puxada horizontal específica de FL.",
      },
      {
        name: "Australian rows / inverted rows",
        category: "forca",
        prescription: "3 × 12-15 · RIR 1",
        note: "Volume para dorsais.",
      },
      {
        name: "Bíceps/antebraço (curl de corpo na barra, supino invertido)",
        category: "forca",
        prescription: "3 × 8-12",
        note: "Saúde do cotovelo.",
      },
      { name: "Hollow body hold", category: "core", prescription: "3 × 20-30s" },
      {
        name: "Lombar (costas no chão) / compressão straddle",
        category: "core",
        prescription: "3 × 1",
      },
    ],
  },
  {
    code: "D2",
    weekday: "Ter",
    title: "Planche + Empurrada",
    focus: "Planche + Empurrada",
    character: "Volume / técnica (submáximo)",
    exercises: [
      {
        name: "Planche lean — hold",
        category: "skill",
        isSkill: true,
        prescription: "4 × 10-15s",
        note: "Proteção + condicionamento de punho/cotovelo. Descanso 2 min.",
      },
      {
        name: "Planche max hold (tuck / adv tuck)",
        category: "skill",
        isSkill: true,
        prescription: "5 × 5-8s na alavanca mais difícil limpa",
        note: "Descanso 2-3 min.",
      },
      {
        name: "Pseudo Planche Push-ups (PPPU, inclinado, protraindo)",
        category: "forca",
        prescription: "4 × 6-10",
        note: "Chave para força e shape do deltoide/serrátil.",
      },
      {
        name: "Dips profundas (controladas)",
        category: "forca",
        prescription: "4 × 8-12 · RIR 1-2",
      },
      {
        name: "Pike push-ups (ou pseudo HSPU)",
        category: "forca",
        prescription: "4 × 5-12",
        note: "Deltoides.",
      },
      {
        name: "Tríceps diamond push-ups",
        category: "forca",
        prescription: "3 × até RIR 1",
      },
      {
        name: "Hollow body hold (pélvica em tuck planche)",
        category: "core",
        prescription: "3 × 20s",
      },
    ],
  },
  {
    code: "D3",
    weekday: "Qua",
    title: "Pernas + Core + Lombar",
    focus: "Pernas + Core + Saúde lombar",
    character: "Recuperação ativa",
    exercises: [
      {
        name: "McGill Big 3 (curl up, prancha lateral, bird dog)",
        category: "core",
        prescription: "2 × 3 circuitos",
        note: "Resiliência da coluna — base de estabilidade/força do core.",
      },
      {
        name: "Agachamento livre + progressão pistol",
        category: "pernas",
        prescription: "4 × 12-20",
      },
      { name: "Nórdico / leg curl", category: "pernas", prescription: "4 × 6-10" },
      {
        name: "Nordic hamstring (progressivo)",
        category: "pernas",
        prescription: "3 × 5-8",
        note: "Saúde do joelho.",
      },
      {
        name: "Ponte de glúteo / hip thrust unilateral",
        category: "pernas",
        prescription: "3 × 12-15",
        note: "Cadeia posterior, amiga da lombar.",
      },
      { name: "Panturrilha", category: "pernas", prescription: "3 × 15-20" },
      {
        name: "Elevação de joelhos suspenso (controlada, sem balanço)",
        category: "core",
        prescription: "3 × 10-15",
      },
    ],
  },
  {
    code: "D4",
    weekday: "Qui",
    title: "Front Lever + Puxada",
    focus: "Front Lever + Puxada",
    character: "Volume / técnica (submáximo)",
    exercises: [
      {
        name: "FL holds submáximos",
        category: "skill",
        isSkill: true,
        prescription: "5-6 × 8-10s numa alavanca mais fácil, limpa",
        note: "Condicionamento tendíneo. Descanso 90s.",
      },
      {
        name: "Pull-ups com tempo (3s excêntrico)",
        category: "forca",
        prescription: "4 × 6-8",
        note: "Troque max holds por mais séries de qualidade.",
      },
      {
        name: "Tuck / Advanced tuck FL rows",
        category: "forca",
        prescription: "3 × 6-8",
      },
      {
        name: "Australian rows / inverted rows",
        category: "forca",
        prescription: "3 × 12-15 · RIR 1",
      },
      {
        name: "Bíceps/antebraço (saúde do cotovelo)",
        category: "forca",
        prescription: "3 × 8-12",
      },
      { name: "Hollow body hold", category: "core", prescription: "3 × 20-30s" },
    ],
  },
  {
    code: "D5",
    weekday: "Sex",
    title: "Planche + Empurrada",
    focus: "Planche + Empurrada",
    character: "Volume / técnica (submáximo)",
    exercises: [
      {
        name: "Planche lean holds",
        category: "skill",
        isSkill: true,
        prescription: "6 × 10-15s",
        note: "Descanso 90s.",
      },
      {
        name: "Tuck / adv tuck holds submáximos",
        category: "skill",
        isSkill: true,
        prescription: "5 × 6-8s",
      },
      {
        name: "PPPU foco hipertrofia (3s excêntrico)",
        category: "forca",
        prescription: "4 × 8-12",
      },
      {
        name: "Dips profundas (controladas)",
        category: "forca",
        prescription: "4 × 8-12 · RIR 1-2",
      },
      {
        name: "Pike push-ups (ou pseudo HSPU)",
        category: "forca",
        prescription: "4 × 5-12",
      },
      {
        name: "Tríceps diamond push-ups",
        category: "forca",
        prescription: "3 × até RIR 1",
      },
      { name: "Hollow body hold", category: "core", prescription: "3 × 20s" },
    ],
  },
];

export const FL_PROGRESSION = [
  "Tuck",
  "Advanced tuck",
  "Straddle / One-leg",
  "Full Front Lever",
];

export const PLANCHE_PROGRESSION = [
  "Planche lean",
  "Tuck",
  "Advanced tuck",
  "Straddle",
  "Full Planche",
];

export const PROGRESSION_RULES = {
  advance:
    "Avance de alavanca quando conseguir 3 séries de holds limpos de 8-10s OU um max hold ≥ 12-15s na alavanca atual.",
  regress: "Regrida se o quadril cai / perde a posição.",
  weekly:
    "Subiu o tempo? → adicione 1s ou 1 rep. Cotovelo ≥ 3 por 2 sessões? → deload. Lombar acima de 0 em estáticos? → revise técnica e procure orientação.",
};

export const PERIODIZATION: CycleWeek[] = [
  { weeks: "1", block: "Reintrodução", what: "~60-70% do esforço, RIR 3+, sem falha. Mapeie suas alavancas atuais." },
  { weeks: "2-5", block: "Acumulação (hipertrofia + reconstrução de skill)", what: "Volume ↑, RIR 1-2 nos acessórios. Isométricos em alavanca moderada com hold limpo. Reconstruir base." },
  { weeks: "6", block: "Deload", what: "~50% do volume, recuperação total." },
  { weeks: "7-10", block: "Intensidade (hold + skill)", what: "Alavanca ↑ no FL/planche, isométricos RIR 0-1 nas últimas séries. Pull-ups com tempo, dips RIR." },
  { weeks: "11", block: "Pico / Teste", what: "Teste hold de FL, hold de planche, registre PRs." },
  { weeks: "12", block: "Deload + retreino", what: "Recomece e estabeleça a nova base. Reinicie o ciclo nas novas alavancas." },
];

export const LOWER_BACK_FLAGS = [
  "Sinais vermelhos (pare e procure profissional): dor irradiando, formigamento, dormência, fraqueza na perna.",
  "Sinal amarelo: dor local leve 2-3/10 durante ou depois → reduza flexão de coluna e carga e priorize coluna neutra.",
  "Hollow body: mantenha a zona lombar no chão (leve reversão da pelve), sem hiperextensão.",
  "Sem flexão de coluna sob fadiga no hollow: prefira anti-extensão (hollow, prancha) e isometria.",
  "Elevação de pernas suspenso: controlada, sem kipping/balanço → use padrão dinâmico só na recuperação.",
  "Prehab de cotovelo (FL/planche gram epicondilite): progressão lenta de alavanca e prehab. Aqueça punho/bíceps sempre.",
];

export function dayByCode(code: string): PlanDay | undefined {
  return PLAN.find((d) => d.code === code);
}

/** Índice da alavanca atual na escada de progressão (-1 se não casar). */
export function leverIndex(progression: string[], lever: string | null): number {
  if (!lever) return -1;
  const cur = lever.toLowerCase();
  return progression.findIndex((s) =>
    cur.includes(s.toLowerCase().split(" ")[0])
  );
}

// Campos de anotação por sessão (cerne da progressão baseada em dados)
export const SESSION_FIELDS = [
  { key: "skill_lever", label: "Skill + alavanca", example: "FL straddle" },
  { key: "max_hold", label: "Max-hold (s)", example: "7s" },
  { key: "sets_time", label: "Séries × tempo/reps", example: "5 × 6s" },
  { key: "rir", label: "RIR (acessórios)", example: "1-2" },
  { key: "elbow", label: "Cotovelo (0-10)", example: "1" },
  { key: "lower_back", label: "Lombar (0-10)", example: "0" },
];
