import type { Category } from "@/lib/plan";

export const CAT: Record<Category, { label: string; color: string; bg: string }> = {
  skill: { label: "SKILL", color: "#D6FB3D", bg: "rgba(214,251,61,0.14)" },
  forca: { label: "FORÇA", color: "#7FE7FF", bg: "rgba(127,231,255,0.12)" },
  core: { label: "CORE", color: "#FFC14D", bg: "rgba(255,193,77,0.12)" },
  pernas: { label: "PERNAS", color: "#FF6FD8", bg: "rgba(255,111,216,0.12)" },
};

export function catOf(c: string | null) {
  return CAT[(c ?? "forca") as Category] ?? CAT.forca;
}

export function PageTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-1">
      <h1 className="animate-fadeUp font-display text-[34px] leading-none">{title}</h1>
      {subtitle && (
        <p className="mt-1 animate-fadeUp text-xs text-muted">{subtitle}</p>
      )}
    </div>
  );
}

export function CategoryChip({ category }: { category: string | null }) {
  const k = catOf(category);
  return (
    <span
      className="chip-mono rounded-md px-1.5 py-1"
      style={{ color: k.color, background: k.bg }}
    >
      {k.label}
    </span>
  );
}

// MOV: eixo de movimento do exercicio. Estatico = isometria/sustentacao (sem
// alongar/encurtar o musculo); Dinamico = movimento com amplitude (rep contada).
// Usamos a mesma estetica do CategoryChip (chip-mono + cor/bg translucido) para
// que os dois selos convivam visualmente lado a lado no card do exercicio.
const MOV: Record<"static" | "dynamic", { label: string; color: string; bg: string }> = {
  // accent/lime do design system (#D6FB3D) — reforca a ideia de "parado/segurando"
  static: { label: "ESTÁTICO", color: "#D6FB3D", bg: "rgba(214,251,61,0.14)" },
  // cyan (#7FE7FF) — mesmo tom usado em FORÇA, sugere fluidez/movimento
  dynamic: { label: "DINÂMICO", color: "#7FE7FF", bg: "rgba(127,231,255,0.12)" },
};

export function MovementChip({ type }: { type: "static" | "dynamic" }) {
  const m = MOV[type];
  return (
    <span
      className="chip-mono rounded-md px-1.5 py-1"
      style={{ color: m.color, background: m.bg }}
    >
      {m.label}
    </span>
  );
}

export function PainPill({ value }: { value: number | null }) {
  if (value === null) return null;
  const color = value >= 3 ? "#FF6F66" : value > 0 ? "#FFC14D" : "#D6FB3D";
  const bg =
    value >= 3
      ? "rgba(255,68,56,0.15)"
      : value > 0
        ? "rgba(255,193,77,0.15)"
        : "rgba(214,251,61,0.15)";
  return (
    <span
      className="font-mono text-[9px] rounded-md px-1.5 py-1"
      style={{ color, background: bg }}
    >
      🦾{value}
    </span>
  );
}
