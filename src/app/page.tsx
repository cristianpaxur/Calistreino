import Link from "next/link";
import { getSetting } from "@/lib/db";
import {
  getStats,
  getSessionsWithSummary,
  getCurrentLevers,
  getBestHolds,
  getCoachData,
} from "@/lib/queries";
import { buildReport } from "@/lib/coach";
import { weekFromStart, cycleWeek, cycleNumber, blockForWeek } from "@/lib/cycle";
import {
  PLAN,
  FL_PROGRESSION,
  PLANCHE_PROGRESSION,
  leverIndex,
} from "@/lib/plan";

export const dynamic = "force-dynamic";

function nextDay(lastCode: string | null): string {
  const order = PLAN.map((d) => d.code);
  if (!lastCode) return "D1";
  const idx = order.indexOf(lastCode);
  return order[(idx + 1) % order.length];
}

function Rungs({ count, idx, color }: { count: number; idx: number; color: string }) {
  return (
    <div className="mt-2.5 flex h-[26px] items-end gap-[3px]">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex-1 rounded-[3px]"
          style={{
            height: 8 + i * 5,
            background: i <= idx ? color : "rgba(255,255,255,0.08)",
          }}
        />
      ))}
    </div>
  );
}

export default async function Home() {
  const [stats, recent, levers, best, cycleStart] = await Promise.all([
    getStats(),
    getSessionsWithSummary(1),
    getCurrentLevers(),
    getBestHolds(),
    getSetting("cycle_start"),
  ]);
  const week = weekFromStart(cycleStart);
  const cw = cycleWeek(week);
  const cn = cycleNumber(week);
  const block = blockForWeek(week);
  const report = buildReport({ ...(await getCoachData()), block });

  const suggested = nextDay(recent[0]?.day_code ?? null);
  const suggestedDay = PLAN.find((d) => d.code === suggested)!;
  const flIdx = leverIndex(FL_PROGRESSION, levers.front);
  const plIdx = leverIndex(PLANCHE_PROGRESSION, levers.planche);

  // anel de progresso da semana do ciclo
  const r = 92;
  const C = 2 * Math.PI * r;
  const ringOff = C * (1 - cw / 12);

  return (
    <div className="px-[18px] pb-28 pt-14">
      {/* header */}
      <div className="mb-1.5 flex animate-fadeUp items-center justify-between">
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] text-muted-2">
            {cycleStart ? `CICLO ${cn} · SEM ${cw}/12` : "CONFIGURE O CICLO"}
          </div>
          <div className="mt-1 font-display text-[26px] uppercase leading-none">
            {block}
          </div>
        </div>
        <Link
          href="/configuracoes"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3.2" stroke="#9A9AA4" strokeWidth="2" />
            <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" stroke="#9A9AA4" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Link>
      </div>

      {/* streak hero */}
      <div className="flex animate-fadeUp flex-col items-center pb-1.5 pt-3.5">
        <div className="mb-1.5 font-mono text-[10px] tracking-[0.3em] text-accent">
          — SEQUÊNCIA ATIVA —
        </div>
        <div className="relative flex h-[222px] w-[222px] items-center justify-center">
          <div className="absolute inset-[18px] animate-ringPulse rounded-full border border-accent/45" />
          <div className="absolute inset-[18px] animate-ringPulse rounded-full border border-accent/45 [animation-delay:1.4s]" />
          <svg width="222" height="222" viewBox="0 0 222 222" className="absolute inset-0 -rotate-90">
            <circle cx="111" cy="111" r="92" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
            <circle
              cx="111" cy="111" r="92" fill="none" stroke="#D6FB3D" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={C.toFixed(0)} strokeDashoffset={ringOff.toFixed(0)}
              style={{ filter: "drop-shadow(0 0 6px rgba(214,251,61,.5))" }}
            />
          </svg>
          <div className="animate-heartbeat text-center">
            <div className="font-display text-[104px] leading-[0.8] text-ink">{stats.streakDays}</div>
            <div className="mt-2 pl-[0.4em] font-mono text-[11px] tracking-[0.4em] text-muted">
              DIAS SEGUIDOS
            </div>
          </div>
        </div>
        <div className="mt-1.5 flex gap-[22px]">
          <Stat n={stats.total} l="SESSÕES" />
          <span className="w-px bg-white/[0.08]" />
          <Stat n={stats.thisWeek} l="7 DIAS" accent />
          <span className="w-px bg-white/[0.08]" />
          <Stat n={stats.bestStreak} l="RECORDE" />
        </div>
      </div>

      {/* treino de hoje */}
      <Link
        href={`/treinar/${suggested}`}
        className="relative mt-5 block animate-fadeUp overflow-hidden rounded-[18px] border border-accent/35 p-[18px]"
        style={{ background: "linear-gradient(180deg, rgba(214,251,61,.16), rgba(214,251,61,.04))" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] text-accent">TREINO DE HOJE</div>
            <div className="mt-1.5 font-display text-[25px] leading-none">
              {suggestedDay.code} · {suggestedDay.focus.split(" + ")[0]}
            </div>
            <div className="mt-1 text-xs text-muted">{suggestedDay.character}</div>
          </div>
          <span
            className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full bg-accent"
            style={{ boxShadow: "0 0 24px rgba(214,251,61,.4)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8V4z" fill="#0A0A0C" /></svg>
          </span>
        </div>
      </Link>

      {/* alavancas */}
      <div className="mt-3.5 grid grid-cols-2 gap-3">
        <div className="card animate-fadeUp">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.16em] text-accent">FRONT LEVER</span>
            <span className="font-mono text-[10px] text-muted-2">PR {best.front ?? "—"}s</span>
          </div>
          <div className="mt-2 font-display text-[21px] leading-none">{levers.front ?? "—"}</div>
          <Rungs count={FL_PROGRESSION.length} idx={flIdx} color="#D6FB3D" />
        </div>
        <div className="card animate-fadeUp">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.16em] text-cyan">PLANCHE</span>
            <span className="font-mono text-[10px] text-muted-2">PR {best.planche ?? "—"}s</span>
          </div>
          <div className="mt-2 font-display text-[21px] leading-none">{levers.planche ?? "—"}</div>
          <Rungs count={PLANCHE_PROGRESSION.length} idx={plIdx} color="#7FE7FF" />
        </div>
      </div>

      {/* coach */}
      <Link href="/coach" className="card mt-3.5 block animate-fadeUp">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" style={{ boxShadow: "0 0 8px #D6FB3D" }} />
            <span className="font-mono text-[10px] tracking-[0.2em] text-accent">COACH</span>
          </div>
          <span className="text-xs text-muted">análise →</span>
        </div>
        <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">{report.overall}</p>
      </Link>
    </div>
  );
}

function Stat({ n, l, accent }: { n: number; l: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <div className={`font-display text-[22px] ${accent ? "text-accent" : ""}`}>{n}</div>
      <div className="font-mono text-[9px] tracking-[0.18em] text-muted-2">{l}</div>
    </div>
  );
}
