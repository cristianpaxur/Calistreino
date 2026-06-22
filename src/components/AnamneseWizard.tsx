"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAnamnese } from "@/app/onboarding/actions";
import {
  sectionsFor,
  validateSection,
  evaluateParq,
  parqDisclaimer,
  type Archetype,
  type Question,
  type Section,
} from "@/lib/anamnese";

// Wizard de anamnese (007 / T-004..T-007). Multi-etapa com barra de progresso.
// A ramificação por arquétipo (T-005) é dirigida por `sectionsFor(archetype)`:
// quando o usuário escolhe o objetivo, o conjunto de seções recomputa. A triagem
// PAR-Q (T-006) deriva flags/disclaimer ao vivo. Ao concluir, chama saveAnamnese
// (T-007) que persiste o perfil e encaminha para a geração de plano (008).
export default function AnamneseWizard({
  initialValues,
}: {
  initialValues: Record<string, unknown>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const archetype = (values.archetype as Archetype) || null;
  // Recomputa as seções conforme o arquétipo (ramificação T-005).
  const sections = useMemo(() => sectionsFor(archetype), [archetype]);
  const total = sections.length;
  const current: Section = sections[Math.min(step, total - 1)];
  const isLast = step >= total - 1;

  const parq = useMemo(() => {
    const answers: Record<string, boolean> = {};
    for (const k of Object.keys(values)) if (k.startsWith("parq_")) answers[k] = !!values[k];
    return evaluateParq(answers);
  }, [values]);

  function set(id: string, v: unknown) {
    setValues((prev) => ({ ...prev, [id]: v }));
    if (errors[id]) setErrors((e) => ({ ...e, [id]: "" }));
  }

  function next() {
    const r = validateSection(current, values);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setErrors({});
    if (isLast) {
      submit();
    } else {
      // Ao sair da seção de objetivo, o passo seguinte já reflete a ramificação.
      setStep((s) => Math.min(s + 1, sections.length - 1));
    }
  }

  function back() {
    setSaveError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  function submit() {
    setSaveError(null);
    startTransition(async () => {
      const res = await saveAnamnese(values);
      if (res.ok) {
        // Encaminha para a geração de plano (008). Rota com fallback textual até
        // 008 existir (R9) — onboarding/plano renderiza "gerando…".
        router.push("/onboarding/plano");
      } else {
        if (res.errors) setErrors(res.errors);
        setSaveError(res.error);
      }
    });
  }

  const progress = total > 0 ? Math.round(((step + 1) / total) * 100) : 0;

  return (
    <div className="px-[18px] pb-32 pt-14">
      {/* progresso */}
      <div className="animate-fadeUp">
        <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.18em] text-muted-2">
          <span>ANAMNESE</span>
          <span>
            {step + 1}/{total}
          </span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* cabeçalho da seção */}
      <h1 className="mt-5 animate-fadeUp font-display text-[28px] leading-none">
        {current.title.toUpperCase()}
      </h1>
      {current.subtitle && (
        <p className="mt-1.5 animate-fadeUp text-[13px] leading-relaxed text-muted">
          {current.subtitle}
        </p>
      )}

      {/* perguntas */}
      <div className="mt-5 flex flex-col gap-4">
        {current.questions.map((q) => (
          <QuestionField
            key={q.id}
            q={q}
            value={values[q.id]}
            error={errors[q.id]}
            onChange={(v) => set(q.id, v)}
          />
        ))}
      </div>

      {/* disclaimer PAR-Q ao vivo (T-006) */}
      {current.id === "parq" && parq.level !== "ok" && (
        <div
          className="mt-5 animate-fadeUp rounded-[14px] p-[15px]"
          style={{
            background: parq.level === "block" ? "rgba(255,68,56,.08)" : "rgba(255,193,77,.08)",
            border:
              parq.level === "block"
                ? "1px solid rgba(255,68,56,.3)"
                : "1px solid rgba(255,193,77,.3)",
          }}
        >
          <div
            className="font-mono text-[10px] tracking-[0.16em]"
            style={{ color: parq.level === "block" ? "#FF6F66" : "#FFC14D" }}
          >
            {parq.level === "block" ? "⚠ LIBERAÇÃO RECOMENDADA" : "⚠ ATENÇÃO"}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#C8C8C2]">
            {parqDisclaimer(parq.level)}
          </p>
        </div>
      )}

      {saveError && (
        <div className="mt-4 font-mono text-[11px] text-danger-soft">{saveError}</div>
      )}

      {/* navegação */}
      <div className="mt-6 flex gap-2.5">
        {step > 0 && (
          <button onClick={back} disabled={pending} className="btn-dark h-[52px] flex-1 text-[14px]">
            VOLTAR
          </button>
        )}
        <button
          onClick={next}
          disabled={pending}
          className="btn-lime h-[52px] flex-[2] text-[14px] disabled:opacity-50"
        >
          {pending ? "…" : isLast ? "CONCLUIR" : "CONTINUAR"}
        </button>
      </div>
    </div>
  );
}

// ── Campo de pergunta (renderiza por kind) ──────────────────────────
function QuestionField({
  q,
  value,
  error,
  onChange,
}: {
  q: Question;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}) {
  return (
    <div className="animate-fadeUp">
      <label className="label">
        {q.label}
        {q.optional && <span className="ml-1.5 text-muted-2">(opcional)</span>}
      </label>
      {q.help && <p className="mt-1 text-[11px] leading-snug text-muted-2">{q.help}</p>}

      {q.kind === "single" && (
        <div className="mt-2.5 flex flex-col gap-2">
          {q.options!.map((o) => {
            const sel = value === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange(o.value)}
                className="rounded-[12px] border px-3.5 py-3 text-left transition-colors"
                style={{
                  borderColor: sel ? "#D6FB3D" : "rgba(255,255,255,0.08)",
                  background: sel ? "rgba(214,251,61,0.08)" : "transparent",
                }}
              >
                <div className="text-[14px] font-semibold" style={{ color: sel ? "#D6FB3D" : undefined }}>
                  {o.label}
                </div>
                {o.hint && <div className="mt-0.5 text-[11px] text-muted">{o.hint}</div>}
              </button>
            );
          })}
        </div>
      )}

      {q.kind === "multi" && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {q.options!.map((o) => {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            const sel = arr.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() =>
                  onChange(sel ? arr.filter((x) => x !== o.value) : [...arr, o.value])
                }
                className="rounded-[11px] border px-3.5 py-2.5 text-[13px] font-semibold transition-colors"
                style={{
                  borderColor: sel ? "#D6FB3D" : "rgba(255,255,255,0.08)",
                  background: sel ? "rgba(214,251,61,0.08)" : "transparent",
                  color: sel ? "#D6FB3D" : "#9A9AA4",
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}

      {q.kind === "number" && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={value === null || value === undefined ? "" : String(value)}
            min={q.min}
            max={q.max}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            className="input w-32"
          />
          {q.unit && <span className="font-mono text-[12px] text-muted-2">{q.unit}</span>}
        </div>
      )}

      {q.kind === "text" && (
        <input
          type="text"
          value={(value as string) ?? ""}
          placeholder={q.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="input mt-2"
        />
      )}

      {q.kind === "parq" && (
        <div className="mt-2 flex gap-2">
          {[
            { v: false, label: "Não" },
            { v: true, label: "Sim" },
          ].map((opt) => {
            const sel = !!value === opt.v;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => onChange(opt.v)}
                className="flex-1 rounded-[11px] border py-2.5 text-[14px] font-semibold transition-colors"
                style={{
                  borderColor: sel
                    ? opt.v
                      ? "#FFC14D"
                      : "#D6FB3D"
                    : "rgba(255,255,255,0.08)",
                  background: sel
                    ? opt.v
                      ? "rgba(255,193,77,0.1)"
                      : "rgba(214,251,61,0.08)"
                    : "transparent",
                  color: sel ? (opt.v ? "#FFC14D" : "#D6FB3D") : "#9A9AA4",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {error && <div className="mt-1.5 font-mono text-[11px] text-danger-soft">{error}</div>}
    </div>
  );
}
