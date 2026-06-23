/**
 * session-draft.ts — Persistência PURA da sessão de treino ativa (spec 011).
 *
 * POR QUE existe: o estado do `WorkoutPlayer` era 100% efêmero (React `useState`),
 * então qualquer saída da tela — refresh (F5), trocar de aba, app em segundo plano,
 * navegar para adicionar exercício — zerava o treino em andamento (relato real do
 * Gustavo, 2026-06-23). Este módulo serializa a sessão num `localStorage` sob uma
 * chave estável, permitindo auto-save + rehidratação e a barra "retomar".
 *
 * POR QUE é puro (sem React, sem "use client"): a (de)serialização é a parte mais
 * crítica e a mais fácil de quebrar silenciosamente. Mantendo-a isolada do componente
 * ela fica testável offline (scripts/verify-session-draft.ts) e reutilizável tanto
 * pelo player quanto pela `ResumeWorkoutBar`. Todo acesso ao `localStorage` é guardado
 * por `typeof window !== "undefined"` (pode rodar no SSR do Next) e por try/catch
 * (RNF-001: sem localStorage / quota cheia → degrada graciosamente, sem quebrar o
 * treino).
 */

/**
 * Uma entrada da sessão — MESMO shape consumido pelo `WorkoutPlayer` (será reusado
 * por ele via import deste tipo, evitando duplicação de contrato). Inclui os campos
 * de 013 (`unit`/`isStatic`) que reclassificam exercícios estáticos x dinâmicos.
 */
export interface SessionEntry {
  name: string;
  /** skill | forca | core | pernas — categoria visual/de agrupamento (mantido). */
  category: string;
  /** metadado: exercício de skill (front lever, planche…) — mantido p/ compat. */
  isSkill: boolean;
  /** 013 — unidade-alvo do exercício: repetições ou segundos (hold). */
  unit: "reps" | "seconds";
  /**
   * 013 — derivado da unidade: `true` => estático (hold/segundos, usa `holds[]`);
   * `false` => dinâmico (reps/séries, usa `setsDone`). Mantido no draft para que a
   * rehidratação não precise reinferir a partir de heurísticas de nome.
   */
  isStatic: boolean;
  prescription: string;
  lever: string;
  holds: number[];
  setsDone: number;
  done: boolean;
}

/**
 * Versão do schema do draft. Bump SEMPRE que o shape de `SessionDraft`/`SessionEntry`
 * mudar de forma incompatível — drafts com `v` diferente são descartados silenciosamente
 * em `loadDraft` (evita rehidratar lixo de uma versão antiga do app).
 */
export const DRAFT_VERSION = 1;

/** Prefixo das chaves no localStorage. Namespaced p/ não colidir com outros dados. */
const KEY_PREFIX = "calistreino:session:";

/** Draft serializável da sessão ativa. Espelha o estado relevante do player. */
export interface SessionDraft {
  /** versão do schema (descarta drafts incompatíveis). */
  v: number;
  /** chave estável da sessão (ver `sessionKey`). */
  key: string;
  dayCode: string;
  programDayId: string | null;
  freestyle: boolean;
  /** mesmo shape do player (reutiliza `SessionEntry`). */
  entries: SessionEntry[];
  /** índice do exercício atual no player. */
  step: number;
  /** epoch ms — base do cronômetro (RNF-002: tempo derivado de timestamp). */
  startedAt: number;
  /** ms acumulados antes da retomada atual (resiliência do elapsed entre pausas). */
  accumulatedMs: number;
  /** epoch ms da última escrita — usado p/ "última escrita vence" entre abas. */
  updatedAt: number;
}

/**
 * Deriva a chave ESTÁVEL da sessão. Estável = mesma sessão lógica (mesmo dia do
 * programa OU mesmo dayCode, mesmo modo) sempre gera a mesma string, p/ que o player
 * rehidrate o draft certo e a barra de retomada saiba qual treino oferecer.
 *
 * Formato: `${programDayId ?? dayCode}|${freestyle ? "free" : "prog"}` (igual ao spec
 * 3.3). Preferimos `programDayId` quando existe pois é o vínculo mais forte com o
 * programa; caímos para `dayCode` na sessão avulsa/sem programa.
 */
export function sessionKey(args: {
  programDayId: string | null;
  dayCode: string;
  freestyle: boolean;
}): string {
  const base = args.programDayId ?? args.dayCode;
  return `${base}|${args.freestyle ? "free" : "prog"}`;
}

/** Monta a chave completa do localStorage a partir da chave lógica da sessão. */
function storageKey(key: string): string {
  return KEY_PREFIX + key;
}

/**
 * Persiste o draft no localStorage sob `calistreino:session:<key>`.
 *
 * TOLERANTE por design (RNF-001 / spec 3.6): em SSR (`window` indefinido), com
 * localStorage indisponível, ou com quota excedida, vira no-op — o treino continua
 * sem persistência, nunca quebra. NÃO mexe em `updatedAt`/`v` aqui: o chamador é
 * responsável por carimbar o draft (o player faz isso ao montar o objeto), mantendo
 * este módulo previsível p/ round-trip nos testes.
 */
export function saveDraft(d: SessionDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(d.key), JSON.stringify(d));
  } catch {
    /* localStorage indisponível ou quota cheia → segue sem persistir. */
  }
}

/**
 * Recupera e valida o draft de uma sessão. Retorna `null` quando:
 * - roda no SSR / localStorage indisponível (try/catch);
 * - não há draft para a chave;
 * - o JSON é inválido (parse falha);
 * - o `v` difere de `DRAFT_VERSION` (schema incompatível → descarta silenciosamente).
 *
 * Validação mínima do shape p/ não rehidratar objetos truncados/corrompidos com um
 * tipo que mente — apenas o necessário p/ o player não explodir ao usar o draft.
 */
export function loadDraft(key: string): SessionDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionDraft>;
    // descarta versões incompatíveis e payloads que não casam com o contrato básico.
    if (parsed.v !== DRAFT_VERSION) return null;
    if (!Array.isArray(parsed.entries)) return null;
    return parsed as SessionDraft;
  } catch {
    /* JSON inválido ou localStorage indisponível → trata como inexistente. */
    return null;
  }
}

/** Remove o draft da sessão (chamado ao salvar o treino ou descartar — RF-006). */
export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(key));
  } catch {
    /* indisponível → nada a limpar, segue. */
  }
}

/**
 * Varre o localStorage e devolve as chaves LÓGICAS de sessão existentes (sem o
 * prefixo). Usado pela barra de retomada p/ saber se há algum treino em andamento.
 * Tolerante a SSR/indisponibilidade (retorna `[]`).
 */
export function listDraftKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const out: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX)) out.push(k.slice(KEY_PREFIX.length));
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Tempo decorrido da sessão em SEGUNDOS, derivado de timestamps (RNF-002): sobrevive
 * a reload porque não depende de ticks em memória. `accumulatedMs` cobre o tempo de
 * execuções anteriores (pausas) e `now - startedAt` o trecho corrente. `floor` p/
 * não exibir um segundo a mais que o decorrido.
 */
export function elapsedFrom(d: SessionDraft, now: number): number {
  return Math.floor((d.accumulatedMs + (now - d.startedAt)) / 1000);
}
