// Seed do programa-modelo (PLAN) para a conta-piloto. PORTÃO HUMANO:
// requer Supabase real + PILOT_USER_ID. NÃO roda no runtime do app.
//
// Uso (humano, uma vez, após aplicar 003_program_model.sql):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... PILOT_USER_ID=<uuid> \
//     node scripts/seed-program.ts
//
// Este é um script ADMIN one-off (service_role + user_id explícito), NÃO o
// runtime do app — o runtime usa anon key + sessão (RLS). Por isso aqui é OK
// usar service_role: é execução manual fora do front-end (R2).

import { createClient } from "@supabase/supabase-js";
import {
  planToProgramDraft,
  planToSkillLadders,
} from "../src/lib/seed-plan.ts";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.env.PILOT_USER_ID;

if (!url || !key) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!userId) {
  console.error("Defina PILOT_USER_ID (uuid da conta-piloto).");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function seedLadders() {
  for (const ladder of planToSkillLadders()) {
    // Escadas globais (owner_user_id null). Idempotente por slug global.
    const { data: existing } = await sb
      .from("skills")
      .select("id")
      .is("owner_user_id", null)
      .eq("slug", ladder.slug)
      .maybeSingle();

    let skillId = existing?.id as string | undefined;
    if (!skillId) {
      const { data, error } = await sb
        .from("skills")
        .insert({ slug: ladder.slug, name: ladder.name, owner_user_id: null })
        .select("id")
        .single();
      if (error) throw error;
      skillId = data.id as string;
      const rows = ladder.levels.map((name, position) => ({
        skill_id: skillId,
        position,
        name,
      }));
      const { error: e2 } = await sb.from("skill_levels").insert(rows);
      if (e2) throw e2;
      console.log(`  escada criada: ${ladder.name} (${ladder.levels.length} níveis)`);
    } else {
      console.log(`  escada já existe: ${ladder.name} (pulada)`);
    }
  }
}

async function seedProgram() {
  const draft = planToProgramDraft();

  // Idempotência simples: se já existe um programa seed com esse nome p/ o piloto, pula.
  const { data: existing } = await sb
    .from("programs")
    .select("id")
    .eq("user_id", userId)
    .eq("source", "seed")
    .eq("name", draft.name)
    .maybeSingle();
  if (existing) {
    console.log(`  programa seed já existe (${existing.id}) — pulado.`);
    return;
  }

  const { data: prog, error } = await sb
    .from("programs")
    .insert({
      user_id: userId,
      name: draft.name,
      archetype: draft.archetype,
      source: draft.source,
      cycle_weeks: draft.cycle_weeks,
      active: false,
    })
    .select("id")
    .single();
  if (error) throw error;
  const programId = prog.id as string;

  for (const d of draft.days) {
    const { data: day, error: ed } = await sb
      .from("program_days")
      .insert({
        program_id: programId,
        user_id: userId,
        code: d.code,
        weekday: d.weekday ?? null,
        title: d.title,
        focus: d.focus ?? null,
        character: d.character ?? null,
        position: d.position ?? 0,
      })
      .select("id")
      .single();
    if (ed) throw ed;

    const exRows = (d.exercises ?? []).map((ex, i) => ({
      program_day_id: day.id,
      user_id: userId,
      exercise_id: ex.exercise_id ?? null,
      exercise_name: ex.exercise_name ?? null,
      is_skill: ex.is_skill ?? false,
      prescription: ex.prescription ?? null,
      target_unit: ex.target_unit ?? "reps",
      target_min: ex.target_min ?? null,
      target_max: ex.target_max ?? null,
      rest_seconds: ex.rest_seconds ?? null,
      position: ex.position ?? i,
      note: ex.note ?? null,
    }));
    if (exRows.length) {
      const { error: ee } = await sb.from("day_exercises").insert(exRows);
      if (ee) throw ee;
    }
  }

  // Ativa (desativando os demais ativos do piloto antes).
  await sb
    .from("programs")
    .update({ active: false })
    .eq("user_id", userId)
    .eq("active", true);
  const { error: ea } = await sb
    .from("programs")
    .update({ active: true })
    .eq("id", programId);
  if (ea) throw ea;

  console.log(`  programa criado e ativado: ${draft.name} (${programId})`);
}

async function main() {
  console.log("Semeando escadas de skill (globais)…");
  await seedLadders();
  console.log("Semeando programa-modelo para o piloto…");
  await seedProgram();
  console.log("✓ Seed concluído.");
}

main().catch((e) => {
  console.error("✗ Seed falhou:", e);
  process.exit(1);
});
