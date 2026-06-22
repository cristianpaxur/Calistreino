// Teste OFFLINE (sem rede) — 006: builder de rotina + catálogo do picker.
// Roda com type-stripping nativo do Node (v23+): node scripts/verify-routine.ts
// Cobre os casos de borda da §6.4: rotina vazia, dia sem exercício, exercício
// sem nome, e o fallback do catálogo (PLAN) + filtro de busca.

import { buildRoutineDraft } from "../src/lib/routine.ts";
import {
  seedExerciseOptions,
  filterOptions,
} from "../src/lib/exercise-catalog.ts";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    console.error("  ✗ " + msg);
    failures++;
  } else {
    console.log("  ✓ " + msg);
  }
}

console.log("buildRoutineDraft — validação");
{
  // sem nome
  const r = buildRoutineDraft({ name: "  ", days: [] });
  check(!r.ok, "rotina sem nome é rejeitada");
}
{
  // nome ok, mas nenhum exercício
  const r = buildRoutineDraft({ name: "Push", days: [{ exercises: [] }] });
  check(!r.ok, "rotina sem exercícios é rejeitada");
}
{
  // exercícios sem nome são descartados → dia some → rejeita
  const r = buildRoutineDraft({
    name: "Push",
    days: [{ exercises: [{ name: "  ", isSkill: false }] }],
  });
  check(!r.ok, "exercício sem nome não conta como exercício válido");
}
{
  // rotina válida
  const r = buildRoutineDraft({
    name: "  Push/Pull  ",
    activate: true,
    days: [
      {
        title: "Empurrada",
        exercises: [
          { name: "Flexão", isSkill: false, prescription: "4×10" },
          { name: "Planche lean", isSkill: true },
          { name: "   ", isSkill: false }, // descartado
        ],
      },
      { exercises: [] }, // dia vazio → descartado
    ],
  });
  check(r.ok, "rotina válida é aceita");
  if (r.ok) {
    check(r.draft.name === "Push/Pull", "nome é trimado");
    check(r.draft.source === "manual", "source = manual");
    check(r.draft.active === true, "activate propaga para active");
    check(r.draft.days.length === 1, "dia vazio descartado");
    const day = r.draft.days[0];
    check(day.code === "D1", "code default D1");
    check(day.title === "Empurrada", "título preservado");
    check(day.exercises.length === 2, "exercício sem nome descartado (2 restam)");
    check(day.exercises[0].target_unit === "reps", "não-skill → reps");
    check(day.exercises[1].target_unit === "seconds", "skill → seconds");
    check(day.exercises[1].is_skill === true, "skill flag preservada");
  }
}

console.log("\nseedExerciseOptions / filterOptions — catálogo fallback");
{
  const opts = seedExerciseOptions();
  check(opts.length > 0, "catálogo do PLAN não vazio");
  check(
    opts.every((o) => o.id === null && o.slug !== null),
    "opções da semente têm id null e slug derivado"
  );
  const skills = opts.filter((o) => o.isSkill);
  check(
    skills.every((o) => o.defaultUnit === "seconds"),
    "skills usam unidade seconds"
  );
  const filtered = filterOptions(opts, "pull");
  check(
    filtered.length > 0 && filtered.every((o) => o.name.toLowerCase().includes("pull")),
    "filtro por texto funciona (case-insensitive)"
  );
  check(filterOptions(opts, "   ").length === opts.length, "filtro vazio retorna tudo");
}

if (failures) {
  console.error(`\n${failures} verificação(ões) falharam.`);
  process.exit(1);
}
console.log("\nTudo verde (006 offline).");
