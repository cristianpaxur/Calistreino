"use client";

import type { Milestone } from "@/lib/milestones";

const STATUS_META: Record<
  Milestone["status"],
  { label: string; color: string; dot: string }
> = {
  achieved: { label: "ATINGIDO", color: "#D6FB3D", dot: "#D6FB3D" },
  in_progress: { label: "EM PROGRESSO", color: "#FFC14D", dot: "#FFC14D" },
  pending: { label: "PENDENTE", color: "#9A9AA4", dot: "rgba(255,255,255,0.25)" },
};

export default function MilestonesPanel({ milestones }: { milestones: Milestone[] }) {
  if (!milestones.length) return null;

  const done = milestones.filter((m) => m.status === "achieved").length;
  const pct = Math.round((done / milestones.length) * 100);

  return (
    <div className="card mt-3.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.16em] text-muted-2">
          MILESTONES
        </span>
        <span className="font-mono text-[10px] text-accent">
          {done}/{milestones.length} · {pct}%
        </span>
      </div>

      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${pct}%`, boxShadow: "0 0 8px #D6FB3D" }}
        />
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {milestones.map((m, i) => {
          const meta = STATUS_META[m.status];
          return (
            <div key={m.id ?? i} className="flex items-start gap-3">
              <span
                className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
                style={{
                  background: meta.dot,
                  boxShadow: m.status !== "pending" ? `0 0 6px ${meta.dot}` : "none",
                }}
              />
              <div className="min-w-0 flex-1">
                <p
                  className="text-[13px] leading-[1.4]"
                  style={{
                    color: m.status === "achieved" ? "#9A9AA4" : "#E8E8E2",
                    textDecoration: m.status === "achieved" ? "line-through" : "none",
                  }}
                >
                  {m.description}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="font-mono text-[8px] tracking-[0.14em]" style={{ color: meta.color }}>
                    {meta.label}
                  </span>
                  {m.dueWeek != null && (
                    <span className="font-mono text-[8px] tracking-[0.1em] text-muted-2">
                      SEM {m.dueWeek}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
