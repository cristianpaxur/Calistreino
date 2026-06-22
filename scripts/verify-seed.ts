// Teste OFFLINE (sem rede): o ProgramDraft gerado pelo seed é equivalente ao PLAN?
// Roda com type-stripping nativo do Node (v23+):  node scripts/verify-seed.ts
// CA-002 / T-008: equivalência seed × PLAN (dias, exercícios, prescrições).

import { PLAN, type PlanExercise } from "../src/lib/plan.ts";
import {
  planToProgramDraft,
  planToSkillLadders,
  SEED_PROGRAM_NAME,
} from "../src/lib/seed-plan.ts";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    console.error("  ✗ " + msg);
    failures++;
  }
}

const draft = planToProgramDraft();

console.log("Verificando seed × PLAN…");
check(draft.name === SEED_PROGRAM_NAME, "nome do programa");
check(draft.source === "seed", "source = seed");
check(draft.active === true, "programa nasce ativo");
check(draft.days.length === PLAN.length, `nº de dias (${draft.days.length} vs ${PLAN.length})`);

for (let i = 0; i < PLAN.length; i++) {
  const planDay = PLAN[i];
  const day = draft.days[i];
  check(!!day, `dia ${i} existe`);
  if (!day) continue;
  check(day.code === planDay.code, `dia ${i}: code (${day.code})`);
  check(day.weekday === planDay.weekday, `dia ${i}: weekday`);
  check(day.title === planDay.title, `dia ${i}: title`);
  check(day.focus === planDay.focus, `dia ${i}: focus`);
  check(day.character === planDay.character, `dia ${i}: character`);
  check(day.position === i, `dia ${i}: position`);
  check(
    day.exercises.length === planDay.exercises.length,
    `dia ${i}: nº exercícios (${day.exercises.length} vs ${planDay.exercises.length})`
  );

  for (let j = 0; j < planDay.exercises.length; j++) {
    const pe: PlanExercise = planDay.exercises[j];
    const de = day.exercises[j];
    check(!!de, `dia ${i} ex ${j} existe`);
    if (!de) continue;
    check(de.exercise_name === pe.name, `dia ${i} ex ${j}: nome (${de.exercise_name})`);
    check(de.prescription === pe.prescription, `dia ${i} ex ${j}: prescription`);
    check(de.is_skill === !!pe.isSkill, `dia ${i} ex ${j}: is_skill`);
    check(
      de.target_unit === (pe.isSkill ? "seconds" : "reps"),
      `dia ${i} ex ${j}: target_unit`
    );
    check((de.note ?? null) === (pe.note ?? null), `dia ${i} ex ${j}: note`);
    check(de.position === j, `dia ${i} ex ${j}: position`);
    check(de.exercise_id === null, `dia ${i} ex ${j}: exercise_id null (nome livre)`);
  }
}

const ladders = planToSkillLadders();
check(ladders.length === 2, "2 escadas (FL + Planche)");
check(
  ladders.every((l) => l.levels.length > 0),
  "escadas têm níveis"
);

if (failures === 0) {
  console.log("✓ Equivalência seed × PLAN confirmada.");
  process.exit(0);
} else {
  console.error(`\n✗ ${failures} verificação(ões) falharam.`);
  process.exit(1);
}
