import { PLAN, PERIODIZATION } from "@/lib/plan";
import { getSetting } from "@/lib/db";
import { weekFromStart, cycleWeek } from "@/lib/cycle";
import { PageTitle } from "@/components/ui";
import PlanBlocks from "@/components/PlanBlocks";

export const dynamic = "force-dynamic";

function currentWeeks(cw: number): string {
  const found = PERIODIZATION.find((p) => {
    if (p.weeks.includes("-")) {
      const [a, b] = p.weeks.split("-").map(Number);
      return cw >= a && cw <= b;
    }
    return Number(p.weeks) === cw;
  });
  return found?.weeks ?? "";
}

export default function PlanoPage() {
  const week = weekFromStart(getSetting("cycle_start"));
  const cw = cycleWeek(week);
  const curWeeks = currentWeeks(cw);

  return (
    <div className="px-[18px] pb-28 pt-14">
      <PageTitle title="O PLANO" subtitle="Periodização · Front Lever + Planche" />

      <div className="mb-2.5 mt-5 font-mono text-[10px] tracking-[0.2em] text-muted-2">
        CICLO DE 12 SEMANAS
      </div>
      <PlanBlocks blocks={PERIODIZATION} currentWeeks={curWeeks} />

      <div className="mb-2.5 mt-[22px] font-mono text-[10px] tracking-[0.2em] text-muted-2">
        SEMANA TIPO
      </div>
      <div className="flex flex-col gap-[7px]">
        {PLAN.map((d) => (
          <div
            key={d.code}
            className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-surface px-3.5 py-3"
          >
            <span className="w-12 font-display text-[15px] text-accent">
              {d.code}·{d.weekday.slice(0, 3).toUpperCase()}
            </span>
            <span className="flex-1 text-[13px] font-semibold">{d.title}</span>
            <span className="font-mono text-[9px] text-muted-2">
              {d.character.split(" ")[0].toUpperCase()}
            </span>
          </div>
        ))}
      </div>

      <div
        className="mt-4 rounded-[14px] p-[15px]"
        style={{ background: "rgba(255,68,56,.08)", border: "1px solid rgba(255,68,56,.25)" }}
      >
        <div className="font-mono text-[10px] tracking-[0.16em] text-danger-soft">
          ⚠ SAÚDE DA LOMBAR
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[#C8C8C2]">
          Dor irradiando, formigamento ou fraqueza na perna → pare e procure um
          profissional. Hollow body: mantenha a lombar no chão, sem hiperextensão.
        </p>
      </div>
    </div>
  );
}
