import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession, getEntries } from "@/lib/queries";
import { getActiveProgramRuntime } from "@/lib/programs";
import { deleteSession } from "@/app/actions";
import { catOf, PainPill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SessionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession(Number(id));
  if (!session) notFound();
  const entries = await getEntries(session.id);
  const runtime = await getActiveProgramRuntime();
  const dayTitle =
    runtime.days.find((d) => d.code === session.day_code)?.title ?? "";

  const dateLabel = new Date(session.date + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="px-[18px] pb-28 pt-14">
      <div className="flex items-center justify-between">
        <Link href="/historico" className="font-mono text-[11px] text-muted-2">
          ← histórico
        </Link>
        <form action={deleteSession}>
          <input type="hidden" name="id" value={session.id} />
          <button type="submit" className="font-mono text-[11px] text-danger-soft">
            excluir
          </button>
        </form>
      </div>

      <div className="mt-3 animate-fadeUp">
        <div className="font-display text-[30px] leading-none">
          {session.day_code} · {dayTitle}
        </div>
        <div className="mt-1 text-xs capitalize text-muted">{dateLabel}</div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {session.week != null && (
          <span className="rounded-md bg-white/[0.05] px-2 py-1 font-mono text-[9px] text-ink">
            SEMANA {session.week}
          </span>
        )}
        {session.block && (
          <span
            className="rounded-md px-2 py-1 font-mono text-[9px]"
            style={{ background: "rgba(214,251,61,0.14)", color: "#D6FB3D" }}
          >
            {session.block.toUpperCase()}
          </span>
        )}
        <PainPill value={session.elbow_pain} />
        {session.lower_back != null && (
          <span
            className="rounded-md px-2 py-1 font-mono text-[9px]"
            style={{
              background:
                session.lower_back >= 3
                  ? "rgba(255,68,56,0.15)"
                  : session.lower_back > 0
                    ? "rgba(255,193,77,0.15)"
                    : "rgba(214,251,61,0.15)",
              color:
                session.lower_back >= 3
                  ? "#FF6F66"
                  : session.lower_back > 0
                    ? "#FFC14D"
                    : "#D6FB3D",
            }}
          >
            🔻{session.lower_back}
          </span>
        )}
      </div>

      {session.notes && (
        <div className="card mt-3 text-[13px] text-ink-soft">{session.notes}</div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {entries.map((e) => {
          const k = catOf(e.category);
          return (
            <div
              key={e.id}
              className={`rounded-[13px] border border-white/[0.06] bg-surface px-3.5 py-3 ${
                e.done ? "" : "opacity-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="chip-mono rounded-md px-1.5 py-1" style={{ color: k.color, background: k.bg }}>
                  {k.label}
                </span>
                <span className="text-[13px] font-semibold">{e.exercise}</span>
                {!e.done && (
                  <span className="font-mono text-[9px] text-muted-2">pulado</span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
                {e.lever && <Field label="alavanca" value={e.lever} hl />}
                {e.max_hold_s != null && <Field label="max-hold" value={`${e.max_hold_s}s`} hl />}
                {e.sets != null && <Field label="séries" value={String(e.sets)} />}
                {e.reps_or_time && <Field label="tempo/reps" value={e.reps_or_time} />}
                {e.rir && <Field label="rir" value={e.rir} />}
              </div>
              {e.notes && <p className="mt-1.5 font-mono text-[10px] italic text-muted-2">{e.notes}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, value, hl }: { label: string; value: string; hl?: boolean }) {
  return (
    <span className="text-muted-2">
      {label}: <span style={{ color: hl ? "#D6FB3D" : "#F4F4F0" }}>{value}</span>
    </span>
  );
}
