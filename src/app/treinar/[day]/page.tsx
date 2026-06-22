import { notFound } from "next/navigation";
import Link from "next/link";
import { dayByCode } from "@/lib/plan";
import { getSetting } from "@/lib/db";
import { getCurrentLevers } from "@/lib/queries";
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
  const { day: code } = await params;
  const { modo } = await searchParams;
  const day = dayByCode(code.toUpperCase());
  if (!day) notFound();

  const [cycleStart, levers] = await Promise.all([
    getSetting("cycle_start"),
    getCurrentLevers(),
  ]);
  const week = weekFromStart(cycleStart);
  const block = blockForWeek(week);
  const today = new Date().toISOString().slice(0, 10);

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
    />
  );
}
