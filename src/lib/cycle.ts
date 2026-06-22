import { PERIODIZATION } from "./plan";

// Ciclo de 12 semanas, repetível.
export const CYCLE_LENGTH = 12;

export function blockForWeek(week: number): string {
  const w = ((week - 1) % CYCLE_LENGTH) + 1;
  const found = PERIODIZATION.find((p) => {
    if (p.weeks.includes("-")) {
      const [a, b] = p.weeks.split("-").map(Number);
      return w >= a && w <= b;
    }
    return Number(p.weeks) === w;
  });
  return found ? found.block : "—";
}

/** Semana atual do ciclo dado a data de início (ISO yyyy-mm-dd). */
export function weekFromStart(startISO: string | null, today = new Date()): number {
  if (!startISO) return 1;
  const start = new Date(startISO + "T00:00:00");
  const diffDays = Math.floor(
    (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return 1;
  const week = Math.floor(diffDays / 7) + 1;
  return week;
}

/** Semana dentro do ciclo de 12 (1..12). */
export function cycleWeek(week: number): number {
  return ((week - 1) % CYCLE_LENGTH) + 1;
}

export function cycleNumber(week: number): number {
  return Math.floor((week - 1) / CYCLE_LENGTH) + 1;
}
