import { notFound } from "next/navigation";
import Link from "next/link";
import { getSetting } from "@/lib/db";
import { getCurrentLevers } from "@/lib/queries";
import { getActiveProgramRuntime } from "@/lib/programs";
import { weekFromStart, blockForWeek } from "@/lib/cycle";
import SessionForm from "@/components/SessionForm";
import WorkoutPlayer from "@/components/WorkoutPlayer";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DayPage({
  params,
  searchParams,
}: {
  params: Promise<{ day: string }>;
  searchParams: Promise<{ modo?: string }>;
}) {
  const { day: rawCode } = await params;
  const { modo } = await searchParams;
  const code = rawCode.toUpperCase();

  const [runtime, cycleStart, levers] = await Promise.all([
    getActiveProgramRuntime(),
    getSetting("cycle_start"),
    getCurrentLevers(),
  ]);

  const day = runtime.days.find((d) => d.code === code);
  if (!day) notFound();

  const week = weekFromStart(cycleStart);
  const block = blockForWeek(week);
  const today = new Date().toISOString().slice(0, 10);

  // FKs do programa p/ vincular as entries (T-006). Vazio quando vem da semente.
  const refs = runtime.refMap.get(code);
  const programDayId = refs ? [...refs.values()][0]?.programDayId ?? null : null;
  const exerciseRefs: Record<string, string> = {};
  if (refs) for (const [name, ref] of refs) exerciseRefs[name] = ref.dayExerciseId;

  if (modo === "manual") {
    return (
      <div className="px-[18px] pb-28 pt-14">
        <Link href={`/treinar/${day.code}`} className="font-mono text-[11px] text-muted-2">
          ▶ modo guiado
        </Link>
        <div className="mt-3">
          <PageTitle title={`${day.code} · ${day.title}`} subtitle={day.character} />
        </div>
        <SessionForm
          day={day}
          defaultDate={today}
          defaultWeek={week}
          defaultBlock={block}
          suggestedLevers={levers}
          programId={runtime.programId}
          programDayId={programDayId}
          exerciseRefs={exerciseRefs}
        />
      </div>
    );
  }

  return (
    <WorkoutPlayer
      day={day}
      defaultDate={today}
      defaultWeek={week}
      defaultBlock={block}
      suggestedLevers={levers}
      programDayId={programDayId}
      exerciseRefs={exerciseRefs}
    />
  );
}
