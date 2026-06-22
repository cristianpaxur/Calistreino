import AnamneseWizard from "@/components/AnamneseWizard";
import { getProfile } from "@/lib/programs";
import { profileToValues } from "@/lib/anamnese";

export const dynamic = "force-dynamic";

// Página da anamnese guiada (007 / T-004). Reabrível/editável depois (T-008):
// pré-preenche o wizard com o perfil existente, se houver. Tolerante à tabela
// `profiles` ainda não aplicada (R9) — abre o wizard vazio.
export default async function AnamnesePage() {
  let initial: Record<string, unknown> = {};
  try {
    const profile = await getProfile();
    if (profile) initial = profileToValues(profile);
  } catch {
    initial = {};
  }
  return <AnamneseWizard initialValues={initial} />;
}
