// Análise por IA (OpenAI) — opcional. Só roda quando OPENAI_API_KEY está definida.
// Recebe o relatório determinístico + métricas e devolve um texto de coach em PT-BR.
import "server-only";
import OpenAI from "openai";
import type { CoachReport } from "./coach";
import type { CoachData } from "./queries";
import type { AnamneseProfile } from "./anamnese";
import type { ProgramTemplate } from "../../supabase/seeds/templates";
import { buildPlanSchema, type AiPlan } from "./plan-schema";

export function getAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  return { apiKey, model, enabled: apiKey.trim().length > 0 };
}

const SYSTEM_PROMPT = `Você é um treinador de calistenia especializado em Front Lever e Planche.
Baseie-se SEMPRE nestas regras do plano do atleta:
- Avançar de alavanca quando conseguir 3 séries de holds limpos de 8-10s OU um max-hold ≥ 12-15s na alavanca atual.
- Regredir/segurar se o quadril cai ou perde a posição.
- Cadeia Front Lever: tuck → advanced tuck → straddle/one-leg → full.
- Cadeia Planche: planche lean → tuck → advanced tuck → straddle → full.
- Cotovelo ≥ 3 (0-10) por 2 sessões → deload.
- Lombar > 0 (0-10) em exercícios estáticos → revisar técnica, priorizar coluna neutra.
- Progressão semanal: se o tempo subiu, adicione +1s ou +1 rep.

Responda em português do Brasil, direto e prático, em no máximo 6 frases curtas.
Comece com um veredito claro (SUBIR, MANTER ou REDUZIR a intensidade) e justifique com os números.
Não invente dados que não estão no resumo. Não dê conselhos médicos.`;

function summarize(data: CoachData, report: CoachReport): string {
  const lines: string[] = [];
  lines.push(`Veredito do motor de regras: ${report.overall}`);
  if (report.deload) lines.push("Fase de DELOAD ativa.");
  for (const r of report.recommendations) {
    lines.push(
      `${r.skill}: alavanca atual=${r.currentLever ?? "—"}, melhor max-hold=${
        r.bestHold ?? "—"
      }s, último=${r.lastHold ?? "—"}s, tendência=${r.trend ?? "—"}, sugestão=${r.verdict}.`
    );
  }
  // Últimas sessões (dor + skills)
  const recent = data.recentSessions.slice(0, 5).map((s) => {
    return `  ${s.date} ${s.day_code}: cotovelo=${s.elbow_pain ?? "—"}, lombar=${
      s.lower_back ?? "—"
    }`;
  });
  if (recent.length) {
    lines.push("Sessões recentes:");
    lines.push(...recent);
  }
  if (report.flags.length) {
    lines.push("Sinais: " + report.flags.map((f) => f.text).join(" | "));
  }
  return lines.join("\n");
}

export async function analyzeWithAI(
  data: CoachData,
  report: CoachReport
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const cfg = getAiConfig();
  if (!cfg.enabled) return { ok: false, error: "OPENAI_API_KEY não configurada." };

  try {
    const client = new OpenAI({ apiKey: cfg.apiKey });
    const completion = await client.chat.completions.create({
      model: cfg.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            "Analise minhas métricas e diga se devo aumentar, manter ou reduzir a intensidade:\n\n" +
            summarize(data, report),
        },
      ],
      temperature: 1,
      max_completion_tokens: 350,
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) return { ok: false, error: "Resposta vazia da IA." };
    return { ok: true, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

// ── Geração de PLANO por IA (008) ────────────────────────────────────
// A IA atua como CONFIGURADORA de um template validado (não geradora livre):
// recebe o template do arquétipo + perfil + restrições e devolve um plano no
// schema do programa (003), com slug RESTRITO (enum) à biblioteca curada (005).
// Structured outputs + enum de slug = metade da rede de segurança; o validador
// (plan-validator) é a outra metade. Sempre 1 chamada por tentativa (RNF-002).

const PLAN_SYSTEM_PROMPT = `Você é um treinador de calistenia que CONFIGURA um template de programa já validado.
NÃO invente exercícios: use APENAS os slugs fornecidos (o schema te obriga a isso).
Sua tarefa é, a partir do perfil do atleta e do template-base:
- escolher a regressão/alavanca certa para a skill alvo conforme o exame físico;
- ajustar séries, faixa de reps/segundos e descanso à disponibilidade e ao nível;
- substituir exercícios por equipamento ausente ou lesão (PAR-Q);
- respeitar tetos de segurança: descanso ≥45s (≥90s em holds de skill), holds ≤30s,
  reps ≤30, no máximo ~28 séries somadas por dia, no máximo os dias disponíveis.
Para skills isométricas use target_unit "seconds"; para força, "reps".
Responda SOMENTE com o JSON do plano no schema. Não adicione texto fora do JSON.`;

function planUserPrompt(
  profile: AnamneseProfile,
  template: ProgramTemplate,
  feedback?: string
): string {
  const lines: string[] = [];
  lines.push("PERFIL DO ATLETA:");
  lines.push(`- Objetivo: ${profile.archetype ?? "—"}${profile.goalSkill ? ` (skill: ${profile.goalSkill})` : ""}`);
  lines.push(`- Idade: ${profile.age ?? "—"}, peso: ${profile.bodyweight ?? "—"}kg, experiência: ${profile.trainingAge ?? "—"}`);
  lines.push(`- Exame físico (benchmarks): ${JSON.stringify(profile.benchmarks)}`);
  lines.push(`- Triagem de saúde (PAR-Q): nível=${profile.healthFlags.level}, flags=${profile.healthFlags.flags.join(",") || "nenhuma"}`);
  lines.push(`- Disponibilidade: ${profile.daysPerWeek ?? "—"} dias/semana, ~${profile.sessionMinutes ?? "—"} min/sessão`);
  lines.push(`- Equipamento: ${profile.equipment.join(", ") || "só peso do corpo"}`);
  lines.push(`- Preferências: ${JSON.stringify(profile.preferences)}`);
  lines.push("");
  lines.push(`TEMPLATE-BASE (${template.id} — ${template.name}, ${template.cycleWeeks} semanas):`);
  lines.push(JSON.stringify(
    template.days.map((d) => ({
      code: d.code,
      title: d.title,
      character: d.character,
      slots: d.slots.map((s) => ({
        slug: s.slug,
        isSkill: !!s.isSkill,
        alts: s.alts ?? [],
        regressions: s.regressions ?? [],
        isFocus: !!s.isFocus,
      })),
    }))
  ));
  if (feedback) {
    lines.push("");
    lines.push("CORRIJA estes problemas da tentativa anterior:");
    lines.push(feedback);
  }
  return lines.join("\n");
}

/** Chama o OpenAI com structured output e devolve o AiPlan bruto (já parseado e
 *  no shape do schema). Lança em erro de rede/parse — o orquestrador
 *  (plan-generator) trata com retry/fallback. */
export async function generatePlanWithAI(args: {
  profile: AnamneseProfile;
  template: ProgramTemplate;
  allowedSlugs: string[];
  feedback?: string;
}): Promise<AiPlan> {
  const cfg = getAiConfig();
  if (!cfg.enabled) throw new Error("OPENAI_API_KEY não configurada.");

  const client = new OpenAI({ apiKey: cfg.apiKey });
  const completion = await client.chat.completions.create({
    model: cfg.model,
    messages: [
      { role: "system", content: PLAN_SYSTEM_PROMPT },
      { role: "user", content: planUserPrompt(args.profile, args.template, args.feedback) },
    ],
    temperature: 1,
    max_completion_tokens: 2000,
    response_format: buildPlanSchema(args.allowedSlugs) as never,
  });
  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("Resposta vazia da IA.");
  return JSON.parse(text) as AiPlan;
}
