import Link from "next/link";

// 010 — CTA de upgrade reutilizável. O client só REFLETE o estado (o gate é no
// servidor). Mostra o motivo e leva ao /billing. Identidade visual: card âmbar
// (mesmo padrão dos avisos de saúde/onboarding).
export default function UpgradeCTA({
  reason,
  compact = false,
}: {
  reason: string;
  compact?: boolean;
}) {
  return (
    <div
      className="animate-fadeUp rounded-[14px] p-[15px]"
      style={{ background: "rgba(214,251,61,.06)", border: "1px solid rgba(214,251,61,.3)" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-base">⚡</span>
        <span className="font-mono text-[10px] tracking-[0.16em] text-accent">PLANO PRO</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[#C8C8C2]">{reason}</p>
      <Link
        href="/billing"
        className={`btn-lime mt-3 flex w-full text-[13px] ${compact ? "h-[42px]" : "h-[46px]"}`}
      >
        VER PLANO PRO
      </Link>
    </div>
  );
}
