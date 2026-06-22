"use client";

import { useState } from "react";
import { runAiCoach } from "@/app/actions";

export default function CoachPanel({ enabled }: { enabled: boolean }) {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await runAiCoach();
      if (res.ok) setText(res.text);
      else setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao consultar a IA.");
    } finally {
      setLoading(false);
    }
  }

  if (!enabled) {
    return (
      <div className="card">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <span className="font-mono text-[10px] tracking-[0.16em] text-muted">
            ANÁLISE POR IA (OPENAI)
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Defina <code className="rounded bg-bg px-1.5 py-0.5 text-[10px] text-accent">OPENAI_API_KEY</code>{" "}
          no <code className="text-[10px]">.env.local</code> para ativar. As recomendações acima funcionam sem isso.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "#131319", border: "1px solid rgba(214,251,61,.25)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <span className="font-mono text-[10px] tracking-[0.16em] text-accent">
            ANÁLISE POR IA
          </span>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="btn-lime h-9 px-4 text-[13px] disabled:opacity-60"
        >
          {loading ? "ANALISANDO..." : text ? "DE NOVO" : "ANALISAR"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(255,68,56,.12)", color: "#FF6F66" }}>
          {error}
        </p>
      )}

      {text && (
        <div className="mt-3 whitespace-pre-wrap rounded-xl bg-bg p-3.5 text-[13px] leading-relaxed text-ink-soft">
          {text}
        </div>
      )}

      {!text && !error && (
        <p className="mt-3 text-xs text-muted">
          Gera uma leitura das suas métricas e recomenda subir, manter ou reduzir a intensidade.
        </p>
      )}
    </div>
  );
}
