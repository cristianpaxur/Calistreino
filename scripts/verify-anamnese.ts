// Teste OFFLINE (sem rede) — 007: anamnese estruturada (ramificação, PAR-Q,
// validação, build do perfil). Roda com type-stripping nativo do Node (v23+):
// node scripts/verify-anamnese.ts
// Cobre §6.3 (os 3 arquétipos geram perfis coerentes) e §6.4 (PAR-Q positivo,
// sem equipamento, pular itens opcionais).

import {
  sectionsFor,
  questionCount,
  validateSection,
  validateProfile,
  evaluateParq,
  parqDisclaimer,
  buildProfile,
  profileToValues,
  PARQ_QUESTIONS,
} from "../src/lib/anamnese.ts";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    console.error("  ✗ " + msg);
    failures++;
  } else {
    console.log("  ✓ " + msg);
  }
}

console.log("Ramificação por arquétipo (T-005)");
{
  const skill = sectionsFor("skill").map((s) => s.id);
  const strength = sectionsFor("strength").map((s) => s.id);
  const health = sectionsFor("health").map((s) => s.id);
  check(skill.includes("skill"), "skill: inclui seção 'skill'");
  check(!strength.includes("skill"), "strength: pula seção 'skill'");
  check(!health.includes("skill"), "health: pula seção 'skill'");

  const skillBench = sectionsFor("skill").find((s) => s.id === "benchmarks")!;
  const strBench = sectionsFor("strength").find((s) => s.id === "benchmarks")!;
  check(
    skillBench.questions.some((q) => q.id === "bm_skill_hold_s"),
    "skill: benchmark de skill injetado"
  );
  check(
    !strBench.questions.some((q) => q.id === "bm_skill_hold_s"),
    "strength: sem benchmark de skill"
  );
  check(
    questionCount("skill") > questionCount("strength"),
    "skill tem mais perguntas que strength"
  );
  // RNF-001: o caminho típico (excluindo a triagem PAR-Q, que é toggle rápido
  // sim/não) fica enxuto (~14). PAR-Q soma 7 perguntas binárias à parte.
  const skillNonParq = questionCount("skill") - PARQ_QUESTIONS.length;
  check(skillNonParq <= 17, `caminho skill enxuto fora do PAR-Q (${skillNonParq})`);
}

console.log("\nTriagem PAR-Q (T-006)");
{
  check(evaluateParq({}).level === "ok", "sem 'sim' → ok");
  check(parqDisclaimer("ok") === null, "ok não tem disclaimer");

  const warn = evaluateParq({ parq_joint: true });
  check(warn.level === "warn", "lesão articular → warn");
  check(warn.flags.includes("parq_joint"), "flag registrada");
  check(parqDisclaimer("warn") !== null, "warn tem disclaimer");

  const block = evaluateParq({ parq_chest_pain: true, parq_joint: true });
  check(block.level === "block", "dor no peito → block (sobrepõe warn)");
  check(parqDisclaimer("block")!.includes("conservador"), "block menciona modo conservador");

  const lb = evaluateParq({ parq_lower_back: true });
  check(lb.level === "block", "lombar irradiando → block");
}

console.log("\nValidação de seção (T-004)");
{
  const goal = sectionsFor(null).find((s) => s.id === "goal")!;
  check(!validateSection(goal, {}).ok, "objetivo vazio é rejeitado");
  check(validateSection(goal, { archetype: "skill" }).ok, "objetivo preenchido passa");

  const profile = sectionsFor("strength").find((s) => s.id === "profile")!;
  const r = validateSection(profile, { age: 5, bodyweight: 70, trainingAge: "1to3y" });
  check(!r.ok && !!r.errors.age, "idade fora do range é rejeitada");
  const r2 = validateSection(profile, { age: 28, bodyweight: 72, trainingAge: "1to3y" });
  check(r2.ok, "perfil válido passa (altura opcional ausente)");
}

console.log("\nbuildProfile + os 3 arquétipos (T-007 / §6.3)");
{
  // skill
  const skill = buildProfile({
    archetype: "skill",
    goalSkill: "front-lever",
    age: 30,
    bodyweight: 75,
    trainingAge: "1to3y",
    bm_pullups: "8",
    bm_skill_hold_s: "5",
    daysPerWeek: "4",
    sessionMinutes: "60",
    equipment: ["bar", "rings"],
    parq_joint: true,
  });
  check(skill.archetype === "skill" && skill.goalSkill === "front-lever", "skill: arquétipo+skill");
  check(skill.benchmarks.bm_pullups === 8, "skill: benchmark numérico convertido");
  check(skill.healthFlags.level === "warn", "skill: PAR-Q warn derivado");
  check(validateProfile(skill).ok, "skill: perfil completo é válido");

  // strength — sem skill, deve ignorar goalSkill mesmo se vier
  const strength = buildProfile({
    archetype: "strength",
    goalSkill: "planche", // deve ser zerado
    age: 25,
    bodyweight: 80,
    trainingAge: "gt3y",
    daysPerWeek: "5",
    sessionMinutes: "90",
    equipment: ["bar"],
  });
  check(strength.goalSkill === null, "strength: goalSkill ignorado");
  check(validateProfile(strength).ok, "strength: perfil válido");

  // health — sem equipamento (§6.4)
  const health = buildProfile({
    archetype: "health",
    age: 45,
    bodyweight: 90,
    trainingAge: "none",
    daysPerWeek: "2",
    sessionMinutes: "30",
    equipment: ["none"],
    parq_chest_pain: true,
  });
  check(health.healthFlags.level === "block", "health: PAR-Q block");
  check(health.equipment.length === 1 && health.equipment[0] === "none", "health: sem equipamento real");
  check(validateProfile(health).ok, "health: perfil válido mesmo com block");

  // round-trip values
  const rt = profileToValues(skill);
  check(rt.archetype === "skill", "profileToValues preserva arquétipo");
  check(rt.parq_joint === true, "profileToValues recupera resposta PAR-Q");
  check(rt.bm_pullups === 8, "profileToValues recupera benchmark");
}

console.log("\nPular itens opcionais (§6.4)");
{
  const minimal = buildProfile({
    archetype: "strength",
    age: 20,
    bodyweight: 60,
    trainingAge: "none",
    daysPerWeek: "3",
    sessionMinutes: "45",
    equipment: ["bands"],
    // todos os benchmarks/sexo/altura/prefs ausentes
  });
  check(validateProfile(minimal).ok, "perfil sem campos opcionais é válido");
  check(Object.keys(minimal.benchmarks).length === 0, "sem benchmarks reportados");
  check(minimal.healthFlags.level === "ok", "PAR-Q em branco = ok");
}

console.log(`\nPAR-Q tem ${PARQ_QUESTIONS.length} perguntas de triagem.`);

if (failures) {
  console.error(`\n${failures} verificação(ões) falharam.`);
  process.exit(1);
}
console.log("\nTudo verde (007 offline).");
