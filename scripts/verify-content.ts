// Teste OFFLINE (sem rede) do conteúdo curado (005). Valida o FORMATO do seed:
// campos obrigatórios, slugs únicos, escadas ordenadas e amarradas ao catálogo.
// Roda com type-stripping nativo do Node (v23+):  node scripts/verify-content.ts
//
// Cobre os critérios de aceitação verificáveis offline:
//   CA-001 (≥40 ex / ≥5 escadas), CA-003 (escada ordenada regressão→meta),
//   CA-004 (filtrável por equipamento/padrão), RF-003 (metadados obrigatórios).

import { EXERCISES } from "../supabase/seeds/exercises.ts";
import { SKILLS } from "../supabase/seeds/skills.ts";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    console.error("  ✗ " + msg);
    failures++;
  }
}

console.log("Verificando conteúdo curado (exercises + skills)…");

// ── Exercícios ───────────────────────────────────────────────────────
check(EXERCISES.length >= 40, `≥40 exercícios (tem ${EXERCISES.length})`);

const slugs = new Set<string>();
const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
for (const ex of EXERCISES) {
  const id = ex.slug || "(sem slug)";
  check(!!ex.slug && slugRe.test(ex.slug), `slug kebab-case válido: ${id}`);
  check(!slugs.has(ex.slug), `slug único: ${id}`);
  slugs.add(ex.slug);
  check(!!ex.name?.trim(), `${id}: name`);
  check(!!ex.category, `${id}: category`);
  check(!!ex.pattern, `${id}: pattern`);
  check(Array.isArray(ex.equipment), `${id}: equipment é array`);
  check(!!ex.cues?.trim(), `${id}: cue obrigatório (RNF-001)`);
  // isométricos devem medir segundos
  if (ex.isSkill && ex.defaultUnit !== undefined) {
    check(ex.defaultUnit === "seconds", `${id}: skill isométrico em 'seconds'`);
  }
}

// Cobertura de padrões básicos (push/pull/legs/core) + isométricos.
for (const p of ["push", "pull", "legs", "core"] as const) {
  check(
    EXERCISES.some((e) => e.pattern === p),
    `cobertura do padrão '${p}'`
  );
}
check(
  EXERCISES.some((e) => e.isSkill),
  "tem exercícios isométricos (isSkill)"
);

// CA-004: filtrável por equipamento e padrão (índices não vazios).
const byEquipment = EXERCISES.filter((e) => e.equipment.includes("bar"));
check(byEquipment.length > 0, "filtro por equipamento 'bar' retorna itens");
const byPattern = EXERCISES.filter((e) => e.pattern === "front");
check(byPattern.length > 0, "filtro por padrão 'front' retorna itens");

// ── Skills / escadas ─────────────────────────────────────────────────
check(SKILLS.length >= 5, `≥5 escadas (tem ${SKILLS.length})`);

const skillSlugs = new Set<string>();
for (const sk of SKILLS) {
  const id = sk.slug || "(sem slug)";
  check(!!sk.slug && slugRe.test(sk.slug), `skill slug válido: ${id}`);
  check(!skillSlugs.has(sk.slug), `skill slug único: ${id}`);
  skillSlugs.add(sk.slug);
  check(!!sk.name?.trim(), `${id}: name`);
  check(sk.levels.length >= 2, `${id}: escada com ≥2 níveis (regressão→meta)`);

  const seenLevelSlugs = new Set<string>();
  for (let i = 0; i < sk.levels.length; i++) {
    const lv = sk.levels[i];
    check(!!lv.name?.trim(), `${id}[${i}]: nome do nível`);
    check(
      slugs.has(lv.exerciseSlug),
      `${id}[${i}]: exerciseSlug '${lv.exerciseSlug}' existe no catálogo`
    );
    check(
      !seenLevelSlugs.has(lv.exerciseSlug),
      `${id}[${i}]: exerciseSlug não repetido na escada`
    );
    seenLevelSlugs.add(lv.exerciseSlug);
  }
}

// As 5 escadas prioritárias da spec (RF-002).
for (const required of ["front-lever", "planche", "handstand", "muscle-up", "pistol"]) {
  check(skillSlugs.has(required), `escada obrigatória presente: ${required}`);
}

if (failures === 0) {
  console.log(
    `✓ Conteúdo válido: ${EXERCISES.length} exercícios, ${SKILLS.length} escadas.`
  );
  process.exit(0);
} else {
  console.error(`\n✗ ${failures} verificação(ões) falharam.`);
  process.exit(1);
}
