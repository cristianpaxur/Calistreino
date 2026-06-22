"use client";

import { useState } from "react";
import Link from "next/link";
import { PLAN } from "@/lib/plan";
import { catOf } from "@/components/ui";

export default function TreinarOverview() {
  const [code, setCode] = useState("D1");
  const day = PLAN.find((d) => d.code === code)!;

  return (
    <div className="px-[18px] pb-28 pt-14">
      <div className="animate-fadeUp font-mono text-[10px] tracking-[0.22em] text-muted-2">
        ESCOLHA O DIA
      </div>
      <div className="mt-2.5 flex animate-fadeUp gap-[7px]">
        {PLAN.map((d) => {
          const sel = d.code === code;
          return (
            <button
              key={d.code}
              onClick={() => setCode(d.code)}
              className="flex-1 rounded-[11px] py-2.5 font-display text-[17px] transition-colors"
              style={{
                background: sel ? "#D6FB3D" : "rgba(255,255,255,0.05)",
                color: sel ? "#0A0A0C" : "#9A9AA4",
              }}
            >
              {d.code}
            </button>
          );
        })}
      </div>

      <div className="mt-[18px] animate-fadeUp">
        <div className="font-display text-[30px] leading-none">{day.title}</div>
        <div className="mt-1.5 text-xs text-muted">
          {day.character} · {day.exercises.length} exercícios
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {day.exercises.map((e, i) => {
          const k = catOf(e.category);
          return (
            <div
              key={i}
              className="flex animate-fadeUp items-center gap-3 rounded-[13px] border border-white/[0.06] bg-surface px-3.5 py-3"
            >
              <div className="w-[22px] font-display text-base text-[#3A3A42]">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold leading-tight">{e.name}</div>
                <div className="mt-0.5 font-mono text-[10px] text-muted-2">{e.prescription}</div>
              </div>
              <span
                className="chip-mono shrink-0 rounded-md px-1.5 py-1"
                style={{ color: k.color, background: k.bg }}
              >
                {k.label}
              </span>
            </div>
          );
        })}
      </div>

      <Link
        href={`/treinar/${day.code}`}
        className="btn-lime mt-[18px] flex h-14 animate-fadeUp"
      >
        <svg width="18" height="18" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8V4z" fill="#0A0A0C" /></svg>
        <span className="text-[20px]">INICIAR TREINO</span>
      </Link>

      <div className="mt-3 text-center">
        <Link
          href={`/treinar/${day.code}?modo=manual`}
          className="font-mono text-[11px] text-muted-2"
        >
          ✎ registro manual
        </Link>
      </div>
    </div>
  );
}
