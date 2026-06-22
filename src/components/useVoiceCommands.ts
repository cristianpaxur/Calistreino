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

const START_WORDS = ["vai", "iniciar", "inicia", "começa", "começar", "comecar", "já", "ja", "agora", "start", "valendo"];
const STOP_WORDS = ["parar", "para", "pare", "parou", "stop", "fim", "acabou", "pronto", "chega"];

function hasWord(text: string, words: string[]): boolean {
  return words.some((w) => new RegExp(`(^|\\s)${w}(\\s|$)`, "i").test(text));
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

  // refs sempre atualizados para evitar closures obsoletos dentro do reconhecimento
  const runningRef = useRef(isRunning);
  runningRef.current = isRunning;
  const startRef = useRef(onStart);
  startRef.current = onStart;
  const stopRef = useRef(onStop);
  stopRef.current = onStop;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const lastFire = useRef(0);

  const recRef = useRef<SpeechRecognitionLike | null>(null);

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
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript + " ";
      }
      text = text.toLowerCase().trim();
      if (!text) return;
      setHeard(text.split(/\s+/).slice(-4).join(" "));

      const now = Date.now();
      if (now - lastFire.current < 900) return;

      if (runningRef.current && hasWord(text, STOP_WORDS)) {
        lastFire.current = now;
        stopRef.current();
      } else if (!runningRef.current && hasWord(text, START_WORDS)) {
        lastFire.current = now;
        startRef.current();
      }
    };

    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setError("Microfone bloqueado. Permita o acesso ao microfone.");
        stopped = true;
      } else if (ev.error === "no-speech" || ev.error === "aborted" || ev.error === "network") {
        // ignora — o onend reinicia
      } else {
        setError(`Voz: ${ev.error}`);
      }
    };

    rec.onend = () => {
      setListening(false);
      // reconhecimento contínuo para sozinho periodicamente (mobile) → reinicia
      if (!stopped && enabledRef.current && recRef.current === rec) {
        try {
          rec.start();
          setListening(true);
        } catch {
          /* já iniciado */
        }
      }
    };

    try {
      setError(null);
      rec.start();
      setListening(true);
    } catch {
      /* noop */
    }

    return () => {
      stopped = true;
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

  return { supported, listening, error, heard };
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
