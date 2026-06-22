import {
  getSkillProgress,
  getPainHistory,
  getCurrentLevers,
} from "@/lib/queries";
import { FL_PROGRESSION, PLANCHE_PROGRESSION, leverIndex } from "@/lib/plan";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

const W = 320;
const H = 140;
const PAD = 14;

function points(vals: number[], maxV: number) {
  const n = Math.max(vals.length, 2);
  return vals.map((v, i) => {
    const x = PAD + (i / (n - 1)) * (W - PAD * 2);
    const y = H - PAD - (v / maxV) * (H - PAD - PAD);
    return { x, y, str: `${x.toFixed(1)},${y.toFixed(1)}` };
  });
}

function Ladder({
  steps,
  idx,
  color,
}: {
  steps: string[];
  idx: number;
  color: string;
}) {
  return (
    <div className="mt-3 flex flex-col-reverse gap-1.5">
      {steps.map((name, i) => (
        <div key={name} className="flex items-center gap-2">
          <span
            className="h-[9px] w-[9px] shrink-0 rounded-full"
            style={{ background: i <= idx ? color : "rgba(255,255,255,0.15)" }}
          />
          <span
            className="text-xs"
            style={{
              color: i === idx ? "#F4F4F0" : i < idx ? "#9A9AA4" : "#5A5A63",
              fontWeight: i === idx ? 700 : 400,
            }}
          >
            {name}
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function ProgressaoPage() {
  const [frontPts, planchePts, painHist, levers] = await Promise.all([
    getSkillProgress("front"),
    getSkillProgress("planche"),
    getPainHistory(),
    getCurrentLevers(),
  ]);
  const front = frontPts.map((p) => p.max_hold_s);
  const planche = planchePts.map((p) => p.max_hold_s);
  const pain = painHist
    .map((p) => p.elbow_pain)
    .filter((v): v is number => v !== null)
    .slice(-12);

  const maxV = Math.max(12, ...front, ...planche);
  const flP = points(front, maxV);
  const plP = points(planche, maxV);

  return (
    <div className="px-[18px] pb-28 pt-14">
      <PageTitle title="PROGRESSÃO" subtitle="Max-hold ao longo do ciclo de 12 semanas" />

      {/* chart */}
      <div className="card mt-[18px] animate-fadeUp px-3.5 pb-3 pt-4">
        <div className="mb-1.5 flex gap-4">
          <Legend color="#D6FB3D" label="FRONT LEVER" />
          <Legend color="#7FE7FF" label="PLANCHE" />
        </div>
        {front.length === 0 && planche.length === 0 ? (
          <div className="flex h-[120px] items-center justify-center font-mono text-[11px] text-muted-2">
            sem dados de max-hold ainda
          </div>
        ) : (
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="block">
            <line x1="14" y1="14" x2="14" y2="118" stroke="rgba(255,255,255,0.08)" />
            <line x1="14" y1="118" x2="306" y2="118" stroke="rgba(255,255,255,0.08)" />
            {planche.length > 1 && (
              <polyline
                points={plP.map((p) => p.str).join(" ")}
                fill="none" stroke="#7FE7FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="900" className="animate-drawLine [animation-delay:.2s]"
              />
            )}
            {front.length > 1 && (
              <polyline
                points={flP.map((p) => p.str).join(" ")}
                fill="none" stroke="#D6FB3D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="900" className="animate-drawLine"
                style={{ filter: "drop-shadow(0 0 4px rgba(214,251,61,.4))" }}
              />
            )}
            {flP.map((p, i) => (
              <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3.2" fill="#0A0A0C" stroke="#D6FB3D" strokeWidth="2" />
            ))}
            {plP.map((p, i) => (
              <circle key={`p${i}`} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="2.6" fill="#0A0A0C" stroke="#7FE7FF" strokeWidth="2" />
            ))}
          </svg>
        )}
      </div>

      {/* ladders */}
      <div className="mt-3.5 grid grid-cols-2 gap-3">
        <div className="card animate-fadeUp">
          <div className="font-mono text-[10px] tracking-[0.14em] text-accent">FRONT LEVER</div>
          <Ladder steps={FL_PROGRESSION} idx={leverIndex(FL_PROGRESSION, levers.front)} color="#D6FB3D" />
        </div>
        <div className="card animate-fadeUp">
          <div className="font-mono text-[10px] tracking-[0.14em] text-cyan">PLANCHE</div>
          <Ladder steps={PLANCHE_PROGRESSION} idx={leverIndex(PLANCHE_PROGRESSION, levers.planche)} color="#7FE7FF" />
        </div>
      </div>

      {/* pain bars */}
      <div className="card mt-3.5 animate-fadeUp">
        <div className="font-mono text-[10px] tracking-[0.16em] text-muted-2">
          HISTÓRICO DE DOR · COTOVELO
        </div>
        {pain.length === 0 ? (
          <div className="mt-3 font-mono text-[11px] text-muted-2">sem registros de dor ainda</div>
        ) : (
          <div className="mt-3.5 flex h-[60px] items-end gap-1.5">
            {pain.map((v, i) => (
              <div
                key={i}
                className="animate-growBar min-h-[3px] flex-1 origin-bottom rounded-t-[3px]"
                style={{
                  height: `${Math.max(8, (v / 10) * 100)}%`,
                  background: v >= 3 ? "#FF4438" : v > 0 ? "rgba(255,193,77,0.7)" : "rgba(214,251,61,0.5)",
                }}
              />
            ))}
          </div>
        )}
        <div className="mt-2 font-mono text-[9px] text-muted-2">
          últimas {pain.length || 0} sessões · alvo ≤ 2
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-[3px] w-3.5 rounded-sm" style={{ background: color }} />
      <span className="font-mono text-[10px] text-muted">{label}</span>
    </div>
  );
}
