// Análise por IA (OpenAI) — opcional. Só roda quando OPENAI_API_KEY está definida.
// Recebe o relatório determinístico + métricas e devolve um texto de coach em PT-BR.
import "server-only";
import OpenAI from "openai";
import type { CoachReport } from "./coach";
import type { CoachData } from "./queries";

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
