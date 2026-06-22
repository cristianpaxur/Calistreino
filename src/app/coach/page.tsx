import Link from "next/link";
import { getCoachData, getStats, getSkillProgress } from "@/lib/queries";
import { buildReport, type Verdict } from "@/lib/coach";
import { getSetting } from "@/lib/db";
import { getAiConfig } from "@/lib/ai";
import { weekFromStart, blockForWeek } from "@/lib/cycle";
import CoachPanel from "@/components/CoachPanel";

export const dynamic = "force-dynamic";

const vLabel: Record<Verdict, string> = {
  subir: "SUBIR",
  manter: "MANTER",
  reduzir: "REDUZIR",
  "sem-dados": "SEM DADOS",
};

export default async function CoachPage() {
  const [data, stats, cycleStart, flPoints] = await Promise.all([
    getCoachData(),
    getStats(),
    getSetting("cycle_start"),
    getSkillProgress("front"),
  ]);
  const week = weekFromStart(cycleStart);
  const block = blockForWeek(week);
  const report = buildReport({ ...data, block });
  const ai = getAiConfig();

  // FL ganho no histórico
  const fl = flPoints.map((p) => p.max_hold_s);
  const flDelta = fl.length >= 2 ? fl[fl.length - 1] - fl[0] : null;

  // dor média (cotovelo) das sessões recentes
  const elbows = data.recentSessions
    .map((s) => s.elbow_pain)
    .filter((v): v is number => v !== null);
  const avgPain =
    elbows.length > 0
      ? (elbows.reduce((a, b) => a + b, 0) / elbows.length).toFixed(1)
      : "—";

  const flags = [
    ...report.recommendations
      .filter((r) => r.verdict !== "sem-dados")
      .map((r) => ({
        level: r.verdict === "reduzir" ? "warn" : "ok",
        tag: r.skill.toUpperCase(),
        text: `${vLabel[r.verdict]} — ${r.reasons[0]}`,
      })),
    ...report.flags.map((f) => ({
      level: f.level,
      tag: f.level === "danger" ? "ALERTA" : f.level === "warn" ? "ATENÇÃO" : "OK",
      text: f.text,
    })),
  ];

  const fcolor = (l: string) =>
    l === "danger" ? "#FF4438" : l === "warn" ? "#FFC14D" : "#D6FB3D";

  return (
    <div className="px-[18px] pb-28 pt-14">
      <div className="flex animate-fadeUp items-center gap-3">
        <Link
          href="/"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M15 4l-8 8 8 8" stroke="#9A9AA4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" style={{ boxShadow: "0 0 8px #D6FB3D" }} />
            <span className="font-mono text-[10px] tracking-[0.2em] text-accent">COACH</span>
          </div>
          <div className="mt-1 font-display text-[24px] leading-none">ANÁLISE SEMANAL</div>
        </div>
      </div>

      <div
        className="mt-[18px] animate-fadeUp rounded-2xl p-[18px]"
        style={{ background: "linear-gradient(180deg, rgba(214,251,61,.1), rgba(214,251,61,.03))", border: "1px solid rgba(214,251,61,.25)" }}
      >
        <p className="text-[15px] font-medium leading-[1.55] text-ink">{report.overall}</p>
      </div>

      <div className="mt-3.5 grid animate-fadeUp grid-cols-3 gap-2.5">
        <StatCard v={String(stats.streakDays)} l="SEQUÊNCIA" color="#D6FB3D" />
        <StatCard v={flDelta != null ? `${flDelta >= 0 ? "+" : ""}${flDelta}s` : "—"} l="FL / HIST" />
        <StatCard v={avgPain} l="DOR MÉDIA" color="#FFC14D" />
      </div>

      <div className="mb-2.5 mt-[22px] font-mono text-[10px] tracking-[0.2em] text-muted-2">
        SINAIS
      </div>
      <div className="flex flex-col gap-2">
        {flags.map((f, i) => (
          <div
            key={i}
            className="flex animate-fadeUp gap-3 rounded-[13px] border bg-surface p-3.5"
            style={{ borderColor: f.level === "warn" ? "rgba(255,193,77,0.25)" : "rgba(255,255,255,0.07)" }}
          >
            <span
              className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
              style={{ background: fcolor(f.level), boxShadow: `0 0 8px ${fcolor(f.level)}` }}
            />
            <div>
              <div className="font-mono text-[9px] tracking-[0.16em]" style={{ color: fcolor(f.level) }}>
                {f.tag}
              </div>
              <p className="mt-1 text-[13px] leading-[1.45] text-ink-soft">{f.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* IA OpenAI */}
      <div className="mt-3.5">
        <CoachPanel enabled={ai.enabled} />
      </div>

      <div className="card mt-3.5">
        <div className="font-mono text-[10px] tracking-[0.16em] text-muted-2">DECISÃO SEMANAL</div>
        <p className="mt-2 text-xs leading-relaxed text-[#C8C8C2]">
          Subiu o tempo? → adicione 1s ou 1 rep. Cotovelo ≥ 3 por 2 sessões? →
          deload. Lombar acima de 0 em estáticos? → revise técnica.
        </p>
      </div>
    </div>
  );
}

function StatCard({ v, l, color }: { v: string; l: string; color?: string }) {
  return (
    <div className="card p-3.5">
      <div className="font-display text-[26px] leading-none" style={{ color: color ?? "#F4F4F0" }}>
        {v}
      </div>
      <div className="mt-1 font-mono text-[8px] tracking-[0.1em] text-muted-2">{l}</div>
    </div>
  );
}
