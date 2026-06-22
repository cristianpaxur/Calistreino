// Teste OFFLINE (sem rede) — 008: templates + geração + validação de plano.
// Roda com type-stripping nativo do Node (v23+): node scripts/verify-plan.ts
//
// Cobre:
//   • T-001: todo slug dos templates existe na biblioteca curada (RNF-001).
//   • T-002/T-003: validador clampa rest/holds/reps/volume e rejeita inválidos.
//   • T-004: fallback determinístico gera plano coerente sem IA.
//   • T-006: loop gerar→validar→regenerar/fallback com IA MOCKADA (sem rede).
//   • T-009: 3 perfis (skill/força/saúde) → planos válidos e executáveis.
//   • T-010: casos de borda — lesão grave, sem equipamento, 2 dias, IA malformada.

import { EXERCISES } from "../supabase/seeds/exercises.ts";
import { TEMPLATES, selectTemplate } from "../supabase/seeds/templates.ts";
import { buildSeedCatalog } from "../src/lib/plan-catalog.ts";
import {
  buildFromTemplate,
  generatePlan,
  validationContextFor,
  pickLeverSlug,
  profileHash,
} from "../src/lib/plan-generator.ts";
import { validatePlan, LIMITS } from "../src/lib/plan-validator.ts";
import { aiPlanToDraft, type AiPlan } from "../src/lib/plan-schema.ts";
import { emptyProfile, type AnamneseProfile } from "../src/lib/anamnese.ts";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    console.error("  ✗ " + msg);
    failures++;
  } else {
    console.log("  ✓ " + msg);
  }
}

const catalog = buildSeedCatalog();
const knownSlugs = new Set(EXERCISES.map((e) => e.slug));

// ── T-001: integridade dos templates ─────────────────────────────────
console.log("Templates — integridade (slugs ∈ biblioteca)");
{
  check(TEMPLATES.length >= 5, `≥5 templates (tem ${TEMPLATES.length})`);
  let allSlugsOk = true;
  for (const t of TEMPLATES) {
    for (const d of t.days) {
      for (const s of d.slots) {
        const slugs = [s.slug, ...(s.alts ?? []), ...(s.regressions ?? [])];
        for (const slug of slugs) {
          if (!knownSlugs.has(slug)) {
            console.error(`    slug desconhecido em ${t.id}/${d.code}: ${slug}`);
            allSlugsOk = false;
          }
        }
      }
    }
  }
  check(allSlugsOk, "todo slug dos templates existe na biblioteca curada");
  check(
    TEMPLATES.some((t) => t.archetype === "strength") &&
      TEMPLATES.some((t) => t.archetype === "health") &&
      TEMPLATES.some((t) => t.archetype === "skill"),
    "cobre os 3 arquétipos (skill/strength/health)"
  );
}

// ── selectTemplate ───────────────────────────────────────────────────
console.log("\nselectTemplate — seleção determinística");
{
  check(selectTemplate("skill", "front-lever").goalSkill === "front-lever", "skill alvo → template da skill");
  check(selectTemplate("strength", null).archetype === "strength", "strength → template de força");
  check(selectTemplate("health", null).archetype === "health", "health → template de saúde");
  check(selectTemplate("skill", "inexistente").id === "general-strength", "skill sem template → fallback força");
}

// ── pickLeverSlug — escolha de alavanca por benchmark ────────────────
console.log("\npickLeverSlug — alavanca pelo exame físico");
{
  const slot = {
    slug: "full-front-lever",
    isSkill: true,
    isFocus: true,
    regressions: ["front-lever-negative", "tuck-front-lever", "advanced-tuck-front-lever", "straddle-front-lever"],
  };
  check(pickLeverSlug(slot, 0, false) === "front-lever-negative", "sem hold → regressão mais fácil");
  check(pickLeverSlug(slot, 14, false) === "full-front-lever", "hold ≥12s → meta");
  check(pickLeverSlug(slot, 100, true) === "front-lever-negative", "PAR-Q block → sempre a mais fácil");
}

// Helpers de perfil
function skillProfile(over: Partial<AnamneseProfile> = {}): AnamneseProfile {
  return {
    ...emptyProfile(),
    archetype: "skill",
    goalSkill: "front-lever",
    age: 28,
    bodyweight: 75,
    trainingAge: "1to3y",
    benchmarks: { bm_pullups: 10, bm_skill_hold_s: 6 },
    daysPerWeek: 3,
    sessionMinutes: 60,
    equipment: ["bar", "parallettes"],
    ...over,
  };
}

// ── T-004 + T-009: fallback determinístico para 3 perfis ─────────────
console.log("\nbuildFromTemplate — fallback determinístico (3 perfis)");
{
  const profiles: { label: string; p: AnamneseProfile }[] = [
    { label: "skill", p: skillProfile() },
    {
      label: "strength",
      p: { ...emptyProfile(), archetype: "strength", age: 30, bodyweight: 80, daysPerWeek: 3, sessionMinutes: 45, equipment: ["bar", "dip-bar"] },
    },
    {
      label: "health",
      p: { ...emptyProfile(), archetype: "health", age: 45, bodyweight: 90, daysPerWeek: 2, sessionMinutes: 30, equipment: [] },
    },
  ];
  for (const { label, p } of profiles) {
    const t = selectTemplate(p.archetype, p.goalSkill);
    const draft = buildFromTemplate(p, t, catalog);
    const ctx = validationContextFor(p, catalog);
    const res = validatePlan(draft, ctx);
    check(res.ok, `${label}: plano válido`);
    check(res.plan.days.length > 0, `${label}: tem dias`);
    check(
      res.plan.days.length <= (p.daysPerWeek ?? 6),
      `${label}: respeita a frequência (${res.plan.days.length} ≤ ${p.daysPerWeek})`
    );
    check(res.plan.source === "ai", `${label}: source=ai`);
    check(
      res.plan.days.every((d) => d.exercises.length >= LIMITS.minExercisesPerDay),
      `${label}: todo dia tem ≥${LIMITS.minExercisesPerDay} exercícios`
    );
  }
}

// ── T-003: validador clampa e rejeita ────────────────────────────────
console.log("\nvalidatePlan — clamp e rejeição");
{
  const p = skillProfile();
  const ctx = validationContextFor(p, catalog);
  // Plano com violações intencionais.
  const bad = {
    name: "Ruim",
    source: "ai" as const,
    cycle_weeks: 12,
    days: [
      {
        code: "D1",
        title: "X",
        focus: "front",
        character: "y",
        position: 0,
        exercises: [
          { exercise_id: null, exercise_name: "Pull", is_skill: false, prescription: "4×50", target_unit: "reps" as const, target_min: 40, target_max: 50, rest_seconds: 5, position: 0, slug: "pull-up" },
          { exercise_id: null, exercise_name: "Hold", is_skill: true, prescription: "5×60s", target_unit: "seconds" as const, target_min: 50, target_max: 60, rest_seconds: 10, position: 1, slug: "tuck-front-lever" },
          { exercise_id: null, exercise_name: "Inventado", is_skill: false, prescription: "3×10", target_unit: "reps" as const, target_min: 8, target_max: 10, rest_seconds: 90, position: 2, slug: "slug-que-nao-existe" },
        ],
      },
    ],
  };
  const res = validatePlan(bad as never, ctx);
  const d1 = res.plan.days[0];
  check(d1.exercises.length === 2, "exercício fora da biblioteca removido");
  check((d1.exercises[0].rest_seconds ?? 0) >= LIMITS.minRestStrength, "descanso de força clampado p/ o mínimo");
  check((d1.exercises[0].target_max ?? 0) <= LIMITS.maxReps, "reps clampadas p/ o teto");
  check((d1.exercises[1].rest_seconds ?? 0) >= LIMITS.minRestSkill, "descanso de skill clampado p/ o mínimo");
  check((d1.exercises[1].target_max ?? 0) <= LIMITS.maxSkillHoldSeconds, "hold clampado p/ o teto");
  check(res.ok, "plano com violações ajustáveis fica ok=true após clamp");
}

// ── T-010: casos de borda ────────────────────────────────────────────
console.log("\nCasos de borda (T-010)");
{
  // Lesão grave (PAR-Q block): poda holds pesados e exercícios não-foco de skill.
  const injured = skillProfile({ healthFlags: { level: "block", flags: ["parq_heart"], answers: {} } });
  const t = selectTemplate(injured.archetype, injured.goalSkill);
  const draft = buildFromTemplate(injured, t, catalog);
  const ctx = validationContextFor(injured, catalog);
  const res = validatePlan(draft, ctx);
  check(res.ok, "lesão grave: ainda gera plano válido");
  const allSlugs = res.plan.days.flatMap((d) => d.exercises.map((e) => (e as { slug?: string }).slug));
  check(
    !allSlugs.includes("full-front-lever") && !allSlugs.includes("straddle-front-lever"),
    "lesão grave: holds pesados de skill removidos/regredidos"
  );
}
{
  // Sem equipamento: não prescreve barra/paralelas.
  const noEquip = { ...emptyProfile(), archetype: "strength" as const, daysPerWeek: 3, sessionMinutes: 45, equipment: [] };
  const t = selectTemplate(noEquip.archetype, null);
  const draft = buildFromTemplate(noEquip, t, catalog);
  const ctx = validationContextFor(noEquip, catalog);
  const res = validatePlan(draft, ctx);
  check(res.ok, "sem equipamento: plano válido");
  const needsBar = res.plan.days.flatMap((d) => d.exercises).filter((e) => {
    const slug = (e as { slug?: string }).slug;
    return slug && (catalog.get(slug)?.equipment ?? []).length > 0;
  });
  check(needsBar.length === 0, "sem equipamento: nenhum exercício que exige equipamento");
}
{
  // Disponibilidade mínima (2 dias).
  const minDays = skillProfile({ daysPerWeek: 2 });
  const res = validatePlan(
    buildFromTemplate(minDays, selectTemplate("skill", "front-lever"), catalog),
    validationContextFor(minDays, catalog)
  );
  check(res.plan.days.length === 2, "2 dias/semana: plano com 2 dias");
}

// ── T-006: loop gerar→validar→regenerar/fallback com IA mockada ──────
console.log("\ngeneratePlan — IA mockada (loop + fallback)");
{
  const p = skillProfile();
  const allowed = [...catalog.keys()];
  const toDraft = (raw: AiPlan) => aiPlanToDraft(raw, (slug) => {
    const info = catalog.get(slug);
    return info ? { id: info.id, name: info.name } : null;
  });

  // (a) IA SEMPRE malformada → cai no fallback determinístico.
  {
    const res = await generatePlan({
      profile: p,
      catalog,
      maxRetries: 2,
      callAi: async () => {
        throw new Error("resposta malformada");
      },
      aiToDraft: toDraft,
    });
    check(res.origin === "fallback", "IA malformada → origin=fallback");
    check(res.validation.ok, "fallback após falha de IA é válido");
    check(res.attempts === 2, "tentou 2× antes do fallback");
  }

  // (b) IA devolve plano válido → origin=ai.
  {
    const good = {
      name: "IA FL",
      archetype: "front-lever",
      cycle_weeks: 12,
      days: [
        {
          code: "D1",
          title: "FL",
          focus: "front",
          character: "intensidade",
          exercises: [
            { slug: "tuck-front-lever", is_skill: true, target_unit: "seconds", sets: 4, target_min: 5, target_max: 8, rest_seconds: 120 },
            { slug: "pull-up", is_skill: false, target_unit: "reps", sets: 4, target_min: 5, target_max: 8, rest_seconds: 120 },
          ],
        },
      ],
    };
    const res = await generatePlan({
      profile: p,
      catalog,
      maxRetries: 2,
      callAi: async () => good as never,
      aiToDraft: toDraft,
    });
    check(res.origin === "ai", "IA válida → origin=ai");
    check(res.validation.ok, "plano da IA passa no validador");
    check(res.attempts === 1, "aceitou na 1ª tentativa");
  }

  // (c) IA devolve slug fora do enum (simula falha de schema) → fallback.
  {
    const bad = {
      name: "IA ruim",
      archetype: "front-lever",
      cycle_weeks: 12,
      days: [
        {
          code: "D1",
          title: "x",
          focus: "front",
          character: "y",
          exercises: [
            { slug: "exercicio-inventado", is_skill: false, target_unit: "reps", sets: 3, target_min: 8, target_max: 10, rest_seconds: 90 },
          ],
        },
      ],
    };
    const res = await generatePlan({
      profile: p,
      catalog,
      maxRetries: 2,
      callAi: async () => bad as never,
      aiToDraft: toDraft,
    });
    check(res.origin === "fallback", "IA com slug inventado → fallback");
  }

  check(allowed.length > 0, "catálogo de slugs permitidos não vazio");
}

// ── profileHash — estável e determinístico ───────────────────────────
console.log("\nprofileHash — auditoria/cache");
{
  const a = skillProfile();
  const b = skillProfile();
  check(profileHash(a) === profileHash(b), "perfis iguais → mesmo hash");
  check(profileHash(a) !== profileHash(skillProfile({ daysPerWeek: 5 })), "perfis diferentes → hash diferente");
}

if (failures) {
  console.error(`\n${failures} verificação(ões) falharam.`);
  process.exit(1);
}
console.log("\nTudo verde (008 offline).");
