import Link from "next/link";
import { getSetting } from "@/lib/db";
import { saveSettings } from "@/app/actions";
import { logout } from "@/app/auth-actions";
import { getAuthConfig } from "@/lib/auth";
import { weekFromStart, blockForWeek, cycleWeek, cycleNumber } from "@/lib/cycle";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function ConfiguracoesPage() {
  const cycleStart = getSetting("cycle_start");
  const week = weekFromStart(cycleStart);
  const { enabled: authEnabled } = getAuthConfig();

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

      {authEnabled && (
        <form action={logout} className="card mt-3.5 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Sessão</div>
            <p className="text-xs text-muted">Autenticado neste dispositivo.</p>
          </div>
          <button type="submit" className="btn-dark h-11 px-4 text-[14px] text-danger-soft">
            🚪 SAIR
          </button>
        </form>
      )}
    </div>
  );
}
