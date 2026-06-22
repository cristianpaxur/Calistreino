import Link from "next/link";
import { getSessionsWithSummary, getStats } from "@/lib/queries";
import { PLAN } from "@/lib/plan";
import { PageTitle, PainPill } from "@/components/ui";

export const dynamic = "force-dynamic";

const WD = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function isoLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default async function HistoricoPage() {
  const [sessions, stats] = await Promise.all([
    getSessionsWithSummary(),
    getStats(),
  ]);

  // heatmap — 12 semanas × 7 dias terminando hoje
  const counts = new Map<string, number>();
  for (const s of sessions) counts.set(s.date, (counts.get(s.date) ?? 0) + 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay();
  // fim da grade = sábado da semana atual
  const gridEnd = new Date(today);
  gridEnd.setDate(gridEnd.getDate() + (6 - dow));
  const weeks: { bg: string }[][] = [];
  for (let w = 11; w >= 0; w--) {
    const days: { bg: string }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(gridEnd);
      date.setDate(gridEnd.getDate() - (w * 7 + (6 - d)));
      const c = date > today ? 0 : counts.get(isoLocal(date)) ?? 0;
      const bg =
        c === 0
          ? "rgba(255,255,255,0.05)"
          : c === 1
            ? "rgba(214,251,61,0.4)"
            : c === 2
              ? "rgba(214,251,61,0.7)"
              : "#D6FB3D";
      days.push({ bg });
    }
    weeks.push(days);
  }

  // agrupa por mês
  const groups: Record<string, typeof sessions> = {};
  for (const s of sessions) {
    const d = new Date(s.date + "T00:00:00");
    const key = `${MES[d.getMonth()]} ${d.getFullYear()}`;
    (groups[key] ??= []).push(s);
  }

  return (
    <div className="px-[18px] pb-28 pt-14">
      <PageTitle
        title="HISTÓRICO"
        subtitle={`${stats.total} sessões · ${stats.streakDays} dias de sequência`}
      />

      {/* heatmap */}
      <div className="card mt-[18px] animate-fadeUp">
        <div className="mb-3 font-mono text-[10px] tracking-[0.16em] text-muted-2">
          CONSISTÊNCIA · 12 SEMANAS
        </div>
        <div className="flex justify-between gap-1">
          {weeks.map((days, i) => (
            <div key={i} className="flex flex-1 flex-col gap-1">
              {days.map((d, j) => (
                <div key={j} className="aspect-square rounded-[3px]" style={{ background: d.bg }} />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5">
          <span className="font-mono text-[9px] text-muted-2">menos</span>
          {["rgba(255,255,255,0.05)", "rgba(214,251,61,0.28)", "rgba(214,251,61,0.6)", "#D6FB3D"].map((c) => (
            <div key={c} className="h-[11px] w-[11px] rounded-[3px]" style={{ background: c }} />
          ))}
          <span className="font-mono text-[9px] text-muted-2">mais</span>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="card mt-5 text-center text-sm text-muted">
          Nenhuma sessão ainda.{" "}
          <Link href="/treinar" className="text-accent">Iniciar a primeira</Link>
        </div>
      ) : (
        Object.entries(groups).map(([month, list]) => (
          <div key={month}>
            <div className="mb-2.5 mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2">
              {month}
            </div>
            <div className="flex flex-col gap-2">
              {list.map((s) => {
                const d = new Date(s.date + "T00:00:00");
                const title = PLAN.find((p) => p.code === s.day_code)?.title ?? s.day_code;
                return (
                  <Link
                    key={s.id}
                    href={`/historico/${s.id}`}
                    className="flex animate-fadeUp items-center gap-3 rounded-[13px] border border-white/[0.06] bg-surface px-3.5 py-3"
                  >
                    <div className="w-[42px] shrink-0 text-center">
                      <div className="font-display text-[20px] leading-none">
                        {String(d.getDate()).padStart(2, "0")}
                      </div>
                      <div className="font-mono text-[8px] tracking-[0.1em] text-muted-2">
                        {WD[d.getDay()]}
                      </div>
                    </div>
                    <div className="w-px self-stretch bg-white/[0.07]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-display text-sm text-accent">{s.day_code}</span>
                        <span className="truncate text-[13px] font-semibold">{title}</span>
                      </div>
                      {s.skill_summary && (
                        <div className="mt-0.5 truncate font-mono text-[10px] text-muted">
                          {s.skill_summary}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <PainPill value={s.elbow_pain} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
