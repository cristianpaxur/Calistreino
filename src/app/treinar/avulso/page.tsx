import { getSetting } from "@/lib/db";
import { getCurrentLevers } from "@/lib/queries";
import { getExerciseCatalog } from "@/lib/programs";
import { weekFromStart, blockForWeek } from "@/lib/cycle";
import WorkoutPlayer from "@/components/WorkoutPlayer";
import type { PlanDay } from "@/lib/plan";

export const dynamic = "force-dynamic";

// Sessão avulsa / freestyle (006 / T-006): começa vazio, adiciona exercícios em
// runtime e salva como qualquer treino (entries sem program_day_id).
export default async function AvulsoPage() {
  const [cycleStart, levers, catalog] = await Promise.all([
    getSetting("cycle_start"),
    getCurrentLevers(),
    getExerciseCatalog(),
  ]);
  const week = weekFromStart(cycleStart);
  const block = blockForWeek(week);
  const today = new Date().toISOString().slice(0, 10);

  // Dia "vazio" — o player avulso preenche os exercícios na hora.
  const emptyDay: PlanDay = {
    code: "AVULSO",
    weekday: "",
    title: "Sessão avulsa",
    focus: "Sessão avulsa",
    character: "freestyle",
    exercises: [],
  };

  return (
    <WorkoutPlayer
      day={emptyDay}
      defaultDate={today}
      defaultWeek={week}
      defaultBlock={block}
      suggestedLevers={levers}
      freestyle
      catalog={catalog}
    />
  );
}
