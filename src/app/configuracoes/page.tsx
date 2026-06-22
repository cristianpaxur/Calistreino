import Link from "next/link";
import { getSetting } from "@/lib/db";
import { createClient } from "@/lib/supabase-server";
import { saveSettings } from "@/app/actions";
import { signOut } from "@/app/auth-actions";
import { weekFromStart, blockForWeek, cycleWeek, cycleNumber } from "@/lib/cycle";
import { getTier } from "@/lib/billing";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const cycleStart = await getSetting("cycle_start");
  const week = weekFromStart(cycleStart);
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const isPro = (await getTier()) === "pro";

  return (
    <div className="px-[18px] pb-28 pt-14">
      <Link href="/" className="font-mono text-[11px] text-muted-2">← início</Link>
      <div className="mt-3">
        <PageTitle title="AJUSTES" subtitle="Início do ciclo de 12 semanas" />
      </div>

      <form action={saveSettings} className="card mt-[18px]">
        <label className="label">Data de início do ciclo</label>
        <input
          type="date"
          name="cycle_start"
          defaultValue={cycleStart ?? new Date().toISOString().slice(0, 10)}
          className="input mt-2"
          required
        />
        {cycleStart && (
          <div className="mt-3 rounded-xl bg-bg p-3 text-[13px]">
            Hoje:{" "}
            <span className="font-semibold text-accent">
              Semana {cycleWeek(week)}/12
            </span>{" "}
            (ciclo {cycleNumber(week)}) — {blockForWeek(week)}
          </div>
        )}
        <button type="submit" className="btn-lime mt-4 flex h-12 w-full text-[16px]">
          SALVAR
        </button>
      </form>

      {/* Anamnese (007 / T-008): reabrível/editável a qualquer momento, mesmo
          para quem entrou no freestyle. */}
      <Link
        href="/onboarding/anamnese"
        className="card mt-3.5 flex items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold">Plano personalizado</div>
          <p className="truncate text-xs text-muted">Responder / editar a anamnese</p>
        </div>
        <span className="font-mono text-[11px] text-accent">abrir →</span>
      </Link>

      {/* Assinatura (010): estado do plano + acesso ao billing. */}
      <Link href="/billing" className="card mt-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Assinatura</div>
          <p className="truncate text-xs text-muted">
            {isPro ? "Plano Pro ativo" : "Plano Grátis — IA + analytics no Pro"}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] tracking-[0.12em]"
          style={
            isPro
              ? { background: "rgba(214,251,61,.12)", color: "#D6FB3D" }
              : { background: "rgba(255,255,255,.06)", color: "#9A9AA4" }
          }
        >
          {isPro ? "PRO" : "FREE"}
        </span>
      </Link>

      <form action={signOut} className="card mt-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Conta</div>
          <p className="truncate text-xs text-muted">{user?.email ?? "—"}</p>
        </div>
        <button type="submit" className="btn-dark h-11 shrink-0 px-4 text-[14px] text-danger-soft">
          🚪 SAIR
        </button>
      </form>
    </div>
  );
}
