import Link from "next/link";
import { getProfile } from "@/lib/programs";
import { parqDisclaimer, GOAL_SKILLS, ARCHETYPES } from "@/lib/anamnese";
import PlanGenerator from "@/components/PlanGenerator";

export const dynamic = "force-dynamic";

// Destino pós-anamnese (007 / R9) + geração de plano (008 / T-008). A IA
// configura um template validado a partir do perfil; sem OPENAI_API_KEY (ou em
// falha) cai no fallback determinístico — sempre produz um plano executável.
// A geração e a revisão acontecem no client (PlanGenerator); aqui montamos o
// resumo do perfil, o disclaimer PAR-Q e os caminhos de fallback.
export default async function OnboardingPlanoPage() {
  let profile = null;
  try {
    profile = await getProfile();
  } catch {
    profile = null;
  }

  const canGenerate = !!profile?.archetype;
  const archetypeLabel = profile?.archetype
    ? ARCHETYPES.find((a) => a.value === profile.archetype)?.label ?? profile.archetype
    : null;
  const skillLabel = profile?.goalSkill
    ? GOAL_SKILLS.find((s) => s.slug === profile.goalSkill)?.label ?? profile.goalSkill
    : null;
  const disclaimer = profile ? parqDisclaimer(profile.healthFlags.level) : null;

  return (
    <div className="px-[18px] pb-28 pt-16">
      <div className="animate-fadeUp font-mono text-[10px] tracking-[0.22em] text-accent">
        PERFIL PRONTO
      </div>
      <h1 className="mt-2 animate-fadeUp font-display text-[30px] leading-none">
        SEU PLANO SOB MEDIDA
      </h1>
      <p className="mt-2 max-w-[300px] animate-fadeUp text-[13px] leading-relaxed text-muted">
        A IA configura um template validado com o seu perfil. Você revisa antes de
        começar — e pode gerar de novo ou ajustar no builder.
      </p>

      {profile && (
        <div className="card mt-5 animate-fadeUp">
          <div className="font-mono text-[10px] tracking-[0.16em] text-muted-2">RESUMO</div>
          <dl className="mt-2.5 flex flex-col gap-1.5 text-[13px]">
            {archetypeLabel && <Row label="Objetivo" value={archetypeLabel} />}
            {skillLabel && <Row label="Skill alvo" value={skillLabel} />}
            {profile.daysPerWeek && <Row label="Frequência" value={`${profile.daysPerWeek}x / semana`} />}
            {profile.sessionMinutes && (
              <Row label="Sessão" value={`~${profile.sessionMinutes} min`} />
            )}
            {profile.equipment.length > 0 && (
              <Row label="Equipamento" value={profile.equipment.join(", ")} />
            )}
          </dl>
        </div>
      )}

      {disclaimer && (
        <div
          className="mt-4 animate-fadeUp rounded-[14px] p-[15px]"
          style={{
            background:
              profile?.healthFlags.level === "block"
                ? "rgba(255,68,56,.08)"
                : "rgba(255,193,77,.08)",
            border:
              profile?.healthFlags.level === "block"
                ? "1px solid rgba(255,68,56,.3)"
                : "1px solid rgba(255,193,77,.3)",
          }}
        >
          <div
            className="font-mono text-[10px] tracking-[0.16em]"
            style={{ color: profile?.healthFlags.level === "block" ? "#FF6F66" : "#FFC14D" }}
          >
            ⚠ SAÚDE
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#C8C8C2]">{disclaimer}</p>
        </div>
      )}

      <PlanGenerator canGenerate={canGenerate} fallbackSlot={<FallbackLinks />} />

      <Link
        href="/onboarding/anamnese"
        className="mt-4 block text-center font-mono text-[11px] text-muted-2"
      >
        editar respostas da anamnese
      </Link>
    </div>
  );
}

function FallbackLinks() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="font-mono text-[10px] tracking-[0.16em] text-muted-2">OU</div>
      <Link href="/montar" className="btn-dark flex h-[48px] w-full text-[13px]">
        MONTAR MANUALMENTE NO BUILDER
      </Link>
      <Link href="/treinar" className="btn-dark flex h-[48px] w-full text-[13px]">
        TREINAR COM O PLANO-MODELO
      </Link>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-2">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
