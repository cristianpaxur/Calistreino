import OnboardingFork from "@/components/OnboardingFork";
import { getProfile } from "@/lib/programs";

export const dynamic = "force-dynamic";

// Bifurcação pós-cadastro (007 / T-003): guiada × freestyle. Reversível — o
// usuário pode voltar e trocar a via a qualquer momento. Lê o perfil (se houver)
// só para destacar a via atual; tolerante à tabela ainda não aplicada (R9).
export default async function OnboardingPage() {
  let currentPath: string | null = null;
  try {
    const profile = await getProfile();
    currentPath = profile?.onboardingPath ?? null;
  } catch {
    currentPath = null; // tabela `profiles` ainda não aplicada → fork segue
  }
  return <OnboardingFork currentPath={currentPath} />;
}
