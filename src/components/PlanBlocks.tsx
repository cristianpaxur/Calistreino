"use client";

import { useState } from "react";
import type { CycleWeek } from "@/lib/plan";

export default function PlanBlocks({
  blocks,
  currentWeeks,
}: {
  blocks: CycleWeek[];
  currentWeeks: string;
}) {
  const [open, setOpen] = useState<string>(currentWeeks);

  return (
    <div className="flex flex-col gap-2">
      {blocks.map((b) => {
        const cur = b.weeks === currentWeeks;
        const isOpen = open === b.weeks;
        return (
          <button
            key={b.weeks}
            onClick={() => setOpen(isOpen ? "" : b.weeks)}
            className="animate-fadeUp rounded-[14px] border px-[15px] py-3.5 text-left"
            style={{
              background: cur ? "rgba(214,251,61,0.1)" : "#131319",
              borderColor: cur ? "rgba(214,251,61,0.35)" : "rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className="whitespace-nowrap font-display text-[17px]"
                  style={{ color: cur ? "#D6FB3D" : "#6E6E78" }}
                >
                  S{b.weeks}
                </span>
                <span
                  className="text-sm font-bold"
                  style={{ color: cur ? "#F4F4F0" : "#D8D8D2" }}
                >
                  {b.block}
                </span>
              </div>
              {cur && (
                <span
                  className="rounded-[5px] px-1.5 py-1 font-mono text-[8px] tracking-[0.12em]"
                  style={{ background: "#D6FB3D", color: "#0A0A0C" }}
                >
                  AGORA
                </span>
              )}
            </div>
            {isOpen && (
              <p className="mt-2 text-xs leading-relaxed text-[#C8C8C2]">{b.what}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
