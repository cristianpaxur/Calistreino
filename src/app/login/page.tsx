import { redirect } from "next/navigation";
import { login } from "@/app/auth-actions";
import { getAuthConfig } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const { enabled } = getAuthConfig();
  if (!enabled) redirect("/");

  const sp = await searchParams;
  const error = sp.error === "1";
  const from = sp.from ?? "/";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg px-7">
      <div className="w-full max-w-sm">
        <div className="mb-9 text-center">
          <div className="font-display text-[44px] leading-none">
            CALIS<span className="text-accent">TREINO</span>
          </div>
          <div className="mt-2 font-mono text-[10px] tracking-[0.3em] text-muted-2">
            FRONT LEVER · PLANCHE
          </div>
        </div>

        <form action={login} className="card">
          <input type="hidden" name="from" value={from} />
          <label className="label" htmlFor="password">Senha</label>
          <input
            id="password"
            name="password"
            type="password"
            autoFocus
            autoComplete="current-password"
            placeholder="••••••••"
            className="input mt-2"
            required
          />
          {error && (
            <p className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(255,68,56,.12)", color: "#FF6F66" }}>
              Senha incorreta.
            </p>
          )}
          <button type="submit" className="btn-lime mt-4 flex h-12 w-full text-[17px]">
            ENTRAR
          </button>
        </form>

        <p className="mt-6 text-center font-mono text-[10px] tracking-[0.1em] text-muted-2">
          ACESSO PESSOAL · SEUS TREINOS SÃO PRIVADOS
        </p>
      </div>
    </div>
  );
}
