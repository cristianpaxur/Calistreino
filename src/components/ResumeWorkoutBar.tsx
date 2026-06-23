"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  listDraftKeys,
  loadDraft,
  elapsedFrom,
  clearDraft,
  type SessionDraft,
} from "@/lib/session-draft";

// Mesmo formato "m:ss" usado no WorkoutPlayer — mantém a leitura do tempo idêntica
// entre o player e a barra de retomada (consistência visual com o cronômetro).
function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Barra flutuante "treino em andamento — retomar".
 *
 * É auto-descoberta: não recebe props. Lê os drafts de sessão direto do
 * `localStorage` via `session-draft` e se mostra sozinha quando há uma sessão
 * ativa pendente. A montagem global fica a cargo do layout (outro agente) — aqui
 * só decidimos *se* e *como* aparecer.
 *
 * Regras de visibilidade:
 *  - Em qualquer rota sob `/treinar`, NÃO renderiza: o player já está aberto e
 *    mostrar "retomar" por cima dele seria redundante e confuso.
 *  - Sem nenhum draft válido, NÃO renderiza (nada para retomar).
 */
export default function ResumeWorkoutBar() {
  const path = usePathname();
  // Rota do player aberto → a barra não deve competir com o próprio treino.
  const onPlayer = path.startsWith("/treinar");

  // Draft "atual" exibido na barra. Mantemos só o mais recente (caso raro de
  // múltiplos drafts) — uma barra só, sem poluir a tela.
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  // Tempo decorrido em segundos, derivado de timestamp (resiliente a reload).
  const [secs, setSecs] = useState(0);
  // Tick local só para forçar o re-render do cronômetro a cada 1s.
  const [, setTick] = useState(0);

  // Descobre o draft mais recente. Roda no mount e sempre que mudar de rota —
  // assim, ao voltar do player (minimizar) ou ao salvar/descartar, a barra
  // reavalia se ainda há algo para retomar. `loadDraft` já tolera localStorage
  // ausente/incompatível (retorna null), então não precisamos de try/catch aqui.
  useEffect(() => {
    if (onPlayer) {
      setDraft(null);
      return;
    }
    const keys = listDraftKeys();
    let best: SessionDraft | null = null;
    for (const key of keys) {
      const d = loadDraft(key);
      // Mais recente vence (updatedAt) — última sessão tocada é a relevante.
      if (d && (!best || d.updatedAt > best.updatedAt)) best = d;
    }
    setDraft(best);
  }, [onPlayer, path]);

  // Recalcula o tempo a cada 1s enquanto a barra está montada e há draft.
  // O valor vem de `elapsedFrom(draft, now)` (timestamp), não de um acumulador
  // em memória — bate exatamente com o cronômetro do player.
  useEffect(() => {
    if (!draft) return;
    const recompute = () => setSecs(elapsedFrom(draft, Date.now()));
    recompute(); // primeiro valor imediato, sem esperar 1s
    const id = setInterval(() => {
      recompute();
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [draft]);

  if (onPlayer || !draft) return null;

  // Destino da retomada: dia do programa (/treinar/CODE) ou sessão avulsa.
  // O player rehidrata pelo draft no mount, então basta levar à rota certa.
  const href = draft.freestyle ? "/treinar/avulso" : `/treinar/${draft.dayCode}`;

  const discard = () => {
    // Confirmação: descartar é destrutivo (perde o treino em andamento).
    if (!window.confirm("Descartar o treino em andamento? Isso apaga o progresso não salvo.")) return;
    clearDraft(draft.key);
    setDraft(null);
  };

  return (
    // Fixa acima da BottomNav, dentro do mesmo container max-w-[440px] do app.
    // z-30 fica acima do conteúdo (z-20 da nav), mas o player nunca renderiza
    // esta barra, então não há conflito de camadas com ele.
    <div className="pointer-events-none fixed inset-x-0 bottom-[78px] z-30 mx-auto w-full max-w-[440px] px-3.5">
      <div
        className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-accent/30 px-3.5 py-2.5"
        style={{
          // Fundo translúcido escuro com leve tom accent — "vidro" sobre o app.
          background: "rgba(20,20,24,0.86)",
          backdropFilter: "blur(16px)",
          boxShadow: "0 0 24px rgba(214,251,61,0.18)",
        }}
      >
        {/* Pulso accent — sinaliza "ao vivo" (treino correndo). */}
        <span
          className="h-2.5 w-2.5 shrink-0 animate-restThrob rounded-full bg-accent"
          style={{ boxShadow: "0 0 8px rgba(214,251,61,0.7)" }}
        />

        {/* Rótulo + dia/tempo. min-w-0 deixa truncar sem empurrar os botões. */}
        <div className="min-w-0 flex-1">
          <div className="label leading-none text-accent">TREINO EM ANDAMENTO</div>
          <div className="mt-1 truncate font-mono text-[12px] text-muted">
            {draft.freestyle ? "AVULSO" : draft.dayCode}
            <span className="text-muted-2"> · </span>
            <span className="text-ink">{fmt(secs)}</span>
          </div>
        </div>

        {/* CTA principal: leva de volta ao player (que rehidrata pelo draft). */}
        <Link
          href={href}
          className="btn-lime h-9 shrink-0 px-3.5 text-[12px] tracking-[0.04em]"
        >
          RETOMAR
        </Link>

        {/* Descartar — pequeno "x", separado do CTA para evitar toque acidental. */}
        <button
          onClick={discard}
          aria-label="Descartar treino em andamento"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] text-muted-2 transition-colors active:scale-[0.96]"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
