"use client";

import { useEffect, useRef, useState } from "react";

// Tipos mínimos da Web Speech API (não estão no lib DOM padrão)
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ---------------------------------------------------------------------------
// Matching tolerante
// ---------------------------------------------------------------------------
// Por que normalizar: resultados do Web Speech vêm com acentuação inconsistente
// (ex.: "pára"/"para"), pontuação ("parar.") e caixa variável. Bluetooth/HFP
// tende a degradar o áudio e produzir transcrições parciais. Normalizar para
// minúsculo + sem acento + sem pontuação amplia o casamento sem regex frágil.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacríticos (á → a)
    .replace(/[^a-z0-9\s]/g, " ") // pontuação vira espaço
    .replace(/\s+/g, " ")
    .trim();
}

// Iniciar: mantém a lista de gatilhos de "vai" e sinônimos.
const START_WORDS = ["vai", "iniciar", "inicia", "comeca", "comecar", "ja", "agora", "start", "valendo"];

// Parar: alvos canônicos já normalizados (sem acento). Casamos por TOKEN exato
// OU por prefixo do token, o que captura formas parciais vindas de resultados
// interinos (ex.: "par", "para", "parar") priorizando latência.
const STOP_WORDS = ["parar", "para", "pare", "parou", "pra", "stop", "fim", "acabou", "pronto", "chega", "pause"];

// Prefixos que, sozinhos, já indicam intenção de parar mesmo em transcrição
// truncada pelo engine (interim). Mantidos curtos mas específicos o bastante
// para não colidir com "vai"/"valendo" (que começam com "va").
const STOP_PREFIXES = ["par", "pra", "stop", "paus", "acab", "pront", "cheg"];

// Tokens que NÃO podem disparar parada por mais que contenham "pa"/"pr".
// Guarda explícita contra falso-positivo a partir de "vai" e variações.
const STOP_BLOCKLIST = new Set(["vai", "valendo", "va", "vamos", "para_de_falar"]);

/**
 * Detecta intenção de INICIAR no texto reconhecido.
 * Pura e testável: recebe texto cru, normaliza internamente.
 */
export function matchStart(text: string): boolean {
  const tokens = normalize(text).split(" ").filter(Boolean);
  return tokens.some((tok) => START_WORDS.includes(tok));
}

/**
 * Detecta intenção de PARAR no texto reconhecido.
 * Pura e testável. Estratégia, em ordem de prioridade por latência:
 *   1) token exato em STOP_WORDS;
 *   2) token que começa com algum STOP_PREFIXES (captura interinos parciais);
 *   3) sequência "pra parar" / "pra par..." (token "pra" seguido de prefixo "par").
 * Nunca casa tokens da STOP_BLOCKLIST (ex.: "vai"), evitando falso-positivo.
 */
export function matchStop(text: string): boolean {
  const tokens = normalize(text).split(" ").filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (STOP_BLOCKLIST.has(tok)) continue;

    // 1) match exato — caminho mais rápido e confiável
    if (STOP_WORDS.includes(tok)) return true;

    // 2) match por prefixo — pega "par", "para", "parar", "paus(e)" etc.
    //    "pra" é prefixo válido por si só, mas só conta como parada quando
    //    seguido de um token "par..." (intenção "pra parar"); "pra" isolado
    //    é ambíguo no PT falado, então não dispara sozinho aqui.
    if (tok === "pra") {
      const next = tokens[i + 1];
      if (next && next.startsWith("par")) return true;
      continue;
    }
    if (STOP_PREFIXES.some((p) => tok.startsWith(p))) return true;
  }
  return false;
}

export function useVoiceCommands(opts: {
  enabled: boolean;
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
  lang?: string;
}) {
  const { enabled, isRunning, onStart, onStop, lang = "pt-BR" } = opts;

  const [supported] = useState<boolean>(() => getCtor() !== null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  // Telemetria opcional (dev): latência do primeiro "heard" do comando até o fire.
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);

  // refs sempre atualizados para evitar closures obsoletos dentro do reconhecimento
  const runningRef = useRef(isRunning);
  runningRef.current = isRunning;
  const startRef = useRef(onStart);
  startRef.current = onStart;
  const stopRef = useRef(onStop);
  stopRef.current = onStop;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Debounce de disparo: reduzido de 900ms → 500ms para acelerar a detecção
  // sem permitir disparo repetido pelo stream interim+final do mesmo comando.
  const lastFire = useRef(0);

  // Cooldown contextual: timestamp até o qual STOP deve ser IGNORADO logo após
  // um onStart. Evita parada falsa imediata quando "vai" é seguido (ou mal
  // transcrito) e o engine ainda está cuspindo o tail do comando de início.
  const stopBlockedUntil = useRef(0);

  // Marca o instante do primeiro "heard" do comando em curso para medir latência.
  const cmdFirstHeardAt = useRef(0);

  const recRef = useRef<SpeechRecognitionLike | null>(null);

  // Constantes de tempo (ms). Internos/opcionais conforme spec 3.3.
  const WATCHDOG_MS = 1500; // sem onresult por esse tempo → abort()+start()
  const COOLDOWN_MS = 700; // ignora STOP nesse intervalo após onStart
  const FIRE_DEBOUNCE_MS = 500;

  useEffect(() => {
    const Ctor = getCtor();
    if (!Ctor) return;

    if (!enabled) {
      // desliga
      if (recRef.current) {
        try {
          recRef.current.onend = null;
          recRef.current.abort();
        } catch {
          /* noop */
        }
        recRef.current = null;
      }
      setListening(false);
      return;
    }

    let stopped = false;

    // ---- Watchdog ----------------------------------------------------------
    // Por que: o reconhecimento contínuo pode "morrer" silenciosamente sem
    // emitir onend (comum no mobile e com Bluetooth/HFP, onde a rota de áudio
    // muda). Sem watchdog, ficaríamos surdos até o próximo onend — que pode
    // nunca vir. Aqui, se passar WATCHDOG_MS sem nenhum onresult, forçamos um
    // ciclo abort()+start() para fechar a janela cega entre reinícios.
    let watchdog: ReturnType<typeof setInterval> | null = null;
    const lastResultAt = { t: Date.now() };

    const hardRestart = () => {
      if (stopped || !enabledRef.current || recRef.current !== rec) return;
      try {
        rec.abort(); // dispara onend → onend faz o start() de volta
      } catch {
        // se abort falhar, tenta start direto como último recurso
        try {
          rec.start();
          setListening(true);
        } catch {
          /* noop */
        }
      }
    };

    const startWatchdog = () => {
      if (watchdog) return;
      lastResultAt.t = Date.now();
      watchdog = setInterval(() => {
        if (stopped || !enabledRef.current) return;
        if (Date.now() - lastResultAt.t >= WATCHDOG_MS) {
          lastResultAt.t = Date.now(); // evita rajada de restarts
          hardRestart();
        }
      }, Math.max(300, Math.floor(WATCHDOG_MS / 3)));
    };

    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      lastResultAt.t = Date.now(); // alimenta o watchdog: estamos vivos

      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript + " ";
      }
      text = text.toLowerCase().trim();
      if (!text) return;
      setHeard(text.split(/\s+/).slice(-4).join(" "));

      const now = Date.now();
      if (now - lastFire.current < FIRE_DEBOUNCE_MS) return;

      if (runningRef.current) {
        // Cooldown contextual: dentro da janela pós-start, NÃO paramos.
        if (now < stopBlockedUntil.current) return;
        if (matchStop(text)) {
          // marca o início da medição na primeira vez que ouvimos o comando
          if (cmdFirstHeardAt.current === 0) cmdFirstHeardAt.current = now;
          lastFire.current = now;
          if (process.env.NODE_ENV !== "production") {
            setLastLatencyMs(now - cmdFirstHeardAt.current);
          }
          cmdFirstHeardAt.current = 0;
          stopRef.current();
        } else {
          // Texto chegou mas ainda não casou: registra o primeiro "heard" do
          // comando para que a latência meça desde o áudio inicial, não desde
          // o frame em que finalmente casou.
          if (cmdFirstHeardAt.current === 0) cmdFirstHeardAt.current = now;
        }
      } else {
        if (matchStart(text)) {
          lastFire.current = now;
          cmdFirstHeardAt.current = 0; // zera medição; o próximo comando é o STOP
          startRef.current();
          // Abre o cooldown: ignora STOP por COOLDOWN_MS a partir de agora.
          stopBlockedUntil.current = now + COOLDOWN_MS;
        }
      }
    };

    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setError("Microfone bloqueado. Permita o acesso ao microfone.");
        stopped = true;
      } else if (ev.error === "no-speech" || ev.error === "aborted" || ev.error === "network") {
        // ignora — o onend/watchdog reiniciam
      } else {
        setError(`Voz: ${ev.error}`);
      }
    };

    rec.onend = () => {
      setListening(false);
      // Restart proativo: o reconhecimento contínuo para sozinho periodicamente
      // (mobile/Bluetooth) → reinicia imediatamente se ainda habilitado. O
      // watchdog cobre o caso em que o onend nem chega a ser chamado.
      if (!stopped && enabledRef.current && recRef.current === rec) {
        try {
          rec.start();
          setListening(true);
          lastResultAt.t = Date.now(); // novo ciclo: reseta o relógio do watchdog
        } catch {
          /* já iniciado */
        }
      }
    };

    try {
      setError(null);
      rec.start();
      setListening(true);
      startWatchdog();
    } catch {
      /* noop */
    }

    return () => {
      stopped = true;
      if (watchdog) {
        clearInterval(watchdog);
        watchdog = null;
      }
      try {
        rec.onend = null;
        rec.abort();
      } catch {
        /* noop */
      }
      if (recRef.current === rec) recRef.current = null;
      setListening(false);
    };
  }, [enabled, lang]);

  return { supported, listening, error, heard, lastLatencyMs };
}

/** Fala curta de confirmação (hands-free). */
export function speak(text: string, lang = "pt-BR") {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 1.1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* noop */
  }
}
