import { signIn, signUp } from "@/app/auth-actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mode?: string; check?: string }>;
}) {
  const sp = await searchParams;
  const isSignup = sp.mode === "signup";
  const error = sp.error;
  const check = sp.check === "1";

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

        <form action={isSignup ? signUp : signIn} className="card">
          <label className="label" htmlFor="email">E-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@email.com"
            className="input mt-2"
            required
          />
          <label className="label mt-3.5" htmlFor="password">Senha</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder="••••••••"
            minLength={6}
            className="input mt-2"
            required
          />

          {check && (
            <p className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(214,251,61,.12)", color: "#D6FB3D" }}>
              Conta criada! Confira seu e-mail para confirmar e depois entre.
            </p>
          )}
          {error && (
            <p className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(255,68,56,.12)", color: "#FF6F66" }}>
              {error}
            </p>
          )}

          <button type="submit" className="btn-lime mt-4 flex h-12 w-full text-[17px]">
            {isSignup ? "CRIAR CONTA" : "ENTRAR"}
          </button>
        </form>

        <p className="mt-5 text-center font-mono text-[11px] text-muted">
          {isSignup ? (
            <>já tem conta? <a href="/login" className="text-accent">entrar</a></>
          ) : (
            <>novo por aqui? <a href="/login?mode=signup" className="text-accent">criar conta</a></>
          )}
        </p>
      </div>
    </div>
  );
}
