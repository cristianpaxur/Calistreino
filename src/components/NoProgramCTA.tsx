import Link from "next/link";

// Estado "sem programa ativo" (004 / T-007). Aparece quando o runtime cai na
// semente por não haver programa no banco. Aponta para o onboarding (007) e o
// builder manual (006) — rotas planejadas; com fallback textual até existirem.
//
// `variant="banner"` => faixa compacta (telas que ainda renderizam a semente).
// `variant="full"`   => bloco grande para telas vazias.
export default function NoProgramCTA({
  variant = "banner",
}: {
  variant?: "banner" | "full";
}) {
  if (variant === "banner") {
    return (
      <div
        className="mb-3.5 animate-fadeUp rounded-[14px] p-3.5"
        style={{ background: "rgba(214,251,61,.08)", border: "1px solid rgba(214,251,61,.25)" }}
      >
        <div className="font-mono text-[10px] tracking-[0.16em] text-accent">
          PLANO DE EXEMPLO
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
          Você ainda não tem um programa ativo — mostrando o plano-modelo.{" "}
          <Link href="/onboarding" className="text-accent underline">
            Monte o seu
          </Link>{" "}
          para personalizar.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fadeUp pt-10 text-center">
      <div className="font-display text-[30px] leading-none">SEM PROGRAMA ATIVO</div>
      <p className="mx-auto mt-3 max-w-[280px] text-[13px] leading-relaxed text-muted">
        Crie um programa para começar a treinar com o player guiado, ou explore o
        plano-modelo de Front Lever + Planche.
      </p>
      <Link href="/onboarding" className="btn-lime mx-auto mt-6 flex h-[50px] w-full max-w-[240px] text-[15px]">
        MONTAR MEU PLANO
      </Link>
      <Link
        href="/montar"
        className="btn-dark mx-auto mt-2.5 flex h-[50px] w-full max-w-[240px] text-[15px]"
      >
        BUILDER MANUAL
      </Link>
    </div>
  );
}
