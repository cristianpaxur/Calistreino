"use server";

import { revalidatePath } from "next/cache";
import {
  buildProfile,
  validateProfile,
  type OnboardingPath,
} from "@/lib/anamnese";

/** Registra a via escolhida no fork (guided | freestyle). Reversível: pode ser
 *  chamada de novo para trocar. Falha silenciosa se a tabela `profiles` ainda
 *  não estiver aplicada (portão humano) — o fork continua navegável (R9). */
export async function chooseOnboardingPath(
  path: OnboardingPath
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { setOnboardingPath } = await import("@/lib/programs");
  try {
    await setOnboardingPath(path);
  } catch (e) {
    // Não bloqueia o fluxo: a navegação para 006 (freestyle) ou anamnese
    // (guided) acontece de qualquer forma; só não registramos a escolha.
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao registrar via." };
  }
  revalidatePath("/onboarding");
  return { ok: true };
}

/** Persiste o perfil produzido pela anamnese. Validação pura como rede de
 *  segurança server-side; PAR-Q já vem normalizado em buildProfile. Encaminha
 *  para a geração de plano (008) quando concluído. */
export async function saveAnamnese(
  values: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string; errors?: Record<string, string> }> {
  const profile = buildProfile(values, "guided");
  const v = validateProfile(profile);
  if (!v.ok) {
    return { ok: false, error: "Revise os campos destacados.", errors: v.errors };
  }
  const { upsertProfile } = await import("@/lib/programs");
  try {
    await upsertProfile(profile, { completed: true });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao salvar o perfil." };
  }
  revalidatePath("/onboarding");
  revalidatePath("/configuracoes");
  return { ok: true };
}

/** Gera o plano a partir do perfil salvo (008) e o ativa. A IA configura um
 *  template validado; sem OPENAI_API_KEY (ou em falha) cai no fallback
 *  determinístico. Tolerante à migração 003/007/005 não aplicada (R1/R9): se o IO
 *  falhar, devolve erro legível e a tela mantém os caminhos de fallback. */
export async function gerarPlano(): Promise<
  | { ok: true; programId: string; origin: "ai" | "fallback"; issues: string[] }
  | { ok: false; error: string }
  | { ok: false; upgrade: true; error: string }
> {
  // 010: gate server-side (RNF-001). A geração de plano por IA é feature Pro.
  // Sem `pro`, devolve sinal de upgrade — a tela mostra o CTA e mantém os
  // caminhos grátis (builder manual / plano-modelo).
  const { requireFeature } = await import("@/lib/billing");
  const gate = await requireFeature("ai_plan");
  if (!gate.allowed) return { ok: false, upgrade: true, error: gate.reason };

  const { getProfile, generateProgramFromProfile } = await import("@/lib/programs");
  let profile;
  try {
    profile = await getProfile();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao ler o perfil." };
  }
  if (!profile || !profile.archetype) {
    return { ok: false, error: "Complete a anamnese antes de gerar o plano." };
  }
  try {
    const res = await generateProgramFromProfile(profile, { activate: true });
    revalidatePath("/");
    revalidatePath("/treinar");
    revalidatePath("/onboarding/plano");
    return { ok: true, programId: res.program.id, origin: res.origin, issues: res.issues };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao gerar o plano." };
  }
}
