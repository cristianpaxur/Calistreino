// Teste OFFLINE (sem rede): o adaptador dbDay → PlanDay reconstrói o PLAN?
// Roda com type-stripping nativo do Node (v23+): node scripts/verify-adapter.ts
// CA-001 / T-001: o que sai do banco, depois de adaptado, é idêntico ao shape
// que o WorkoutPlayer já consumia a partir de PLAN.

import { PLAN } from "../src/lib/plan.ts";
import { planToProgramDraft } from "../src/lib/seed-plan.ts";
import {
  adaptProgram,
  buildExerciseRefMap,
} from "../src/lib/program-adapter.ts";
import type {
  ProgramView,
  ProgramDayWithExercises,
  DayExercise,
} from "../src/lib/program-types.ts";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    console.error("  ✗ " + msg);
    failures++;
  }
}

// Constrói um ProgramView "como se viesse do banco" a partir do draft do seed,
// preenchendo ids estáveis (o banco usaria uuids; aqui só precisam ser únicos).
const draft = planToProgramDraft();
const days: ProgramDayWithExercises[] = draft.days.map((d, di) => {
  const exercises: DayExercise[] = d.exercises.map((ex, ei) => ({
    id: `ex-${di}-${ei}`,
    program_day_id: `day-${di}`,
    user_id: "u",
    exercise_id: ex.exercise_id ?? null,
    exercise_name: ex.exercise_name ?? null,
    is_skill: !!ex.is_skill,
    prescription: ex.prescription ?? null,
    target_unit: ex.target_unit ?? "reps",
    target_min: ex.target_min ?? null,
    target_max: ex.target_max ?? null,
    rest_seconds: ex.rest_seconds ?? null,
    position: ex.position ?? ei,
    note: ex.note ?? null,
    created_at: "",
  }));
  return {
    id: `day-${di}`,
    program_id: "p",
    user_id: "u",
    code: d.code,
    weekday: d.weekday ?? null,
    title: d.title,
    focus: d.focus ?? null,
    character: d.character ?? null,
    position: d.position ?? di,
    created_at: "",
    exercises,
  };
});

const view: ProgramView = {
  id: "p",
  user_id: "u",
  name: draft.name,
  archetype: draft.archetype ?? null,
  source: "seed",
  cycle_weeks: draft.cycle_weeks ?? null,
  active: true,
  meta: null,
  created_at: "",
  days,
};

console.log("Verificando adaptador dbDay → PlanDay × PLAN…");

const adapted = adaptProgram(view);
check(adapted.length === PLAN.length, `nº de dias (${adapted.length} vs ${PLAN.length})`);

for (let i = 0; i < PLAN.length; i++) {
  const a = adapted[i];
  const p = PLAN[i];
  check(!!a, `dia ${i} existe`);
  if (!a) continue;
  check(a.code === p.code, `dia ${i}: code (${a.code})`);
  check(a.weekday === p.weekday, `dia ${i}: weekday (${a.weekday})`);
  check(a.title === p.title, `dia ${i}: title`);
  check(a.focus === p.focus, `dia ${i}: focus`);
  check(a.character === p.character, `dia ${i}: character`);
  check(
    a.exercises.length === p.exercises.length,
    `dia ${i}: nº exercícios (${a.exercises.length} vs ${p.exercises.length})`
  );
  for (let j = 0; j < p.exercises.length; j++) {
    const ae = a.exercises[j];
    const pe = p.exercises[j];
    check(!!ae, `dia ${i} ex ${j} existe`);
    if (!ae) continue;
    check(ae.name === pe.name, `dia ${i} ex ${j}: nome (${ae.name})`);
    check(ae.prescription === pe.prescription, `dia ${i} ex ${j}: prescription`);
    check(ae.isSkill === !!pe.isSkill, `dia ${i} ex ${j}: isSkill`);
    check((ae.note ?? undefined) === (pe.note ?? undefined), `dia ${i} ex ${j}: note`);
    // Skills viram category "skill"; o resto, "forca" (heurística do adaptador).
    check(
      ae.category === (pe.isSkill ? "skill" : ae.category),
      `dia ${i} ex ${j}: category coerente`
    );
  }
}

// Mapa de FKs: todo exercício deve resolver para ids do dia certo.
const refMap = buildExerciseRefMap(view);
check(refMap.size === PLAN.length, "refMap cobre todos os dias");
for (const day of view.days) {
  const byName = refMap.get(day.code);
  check(!!byName, `refMap tem o dia ${day.code}`);
  if (!byName) continue;
  for (const ex of day.exercises) {
    const ref = byName.get(ex.exercise_name ?? "");
    check(
      !!ref && ref.dayExerciseId === ex.id && ref.programDayId === day.id,
      `refMap resolve ${day.code} / ${ex.exercise_name}`
    );
  }
}

if (failures === 0) {
  console.log("✓ Adaptador reconstrói o PLAN e o refMap está coerente.");
  process.exit(0);
} else {
  console.error(`\n✗ ${failures} verificação(ões) falharam.`);
  process.exit(1);
}
