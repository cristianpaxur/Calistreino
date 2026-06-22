// Seed do conteúdo curado (005 / T-004): biblioteca de exercícios + escadas de
// skill, como linhas GLOBAIS (owner_user_id null). IDEMPOTENTE por slug.
//
// PORTÃO HUMANO: requer Supabase real + chaves. NÃO roda no runtime do app.
//
// Uso (humano, após aplicar 003_program_model.sql):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed.ts
//
// Idempotência (CA-002): para cada slug fazemos upsert "buscar→inserir/atualizar".
// Rodar 2× não duplica: o segundo run encontra o slug existente e atualiza campos.
//
// Por que service_role aqui é OK (R2): é script ADMIN one-off fora do front-end.
// O runtime do app continua usando anon key + sessão (RLS). NUNCA no cliente.

import { createClient } from "@supabase/supabase-js";
import { EXERCISES } from "../supabase/seeds/exercises.ts";
import { SKILLS } from "../supabase/seeds/skills.ts";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

// ── Biblioteca de exercícios ─────────────────────────────────────────
// Mapa slug → id (preenchido durante o seed; usado pelas escadas).
const exerciseIdBySlug = new Map<string, string>();

async function seedExercises() {
  let created = 0;
  let updated = 0;
  for (const ex of EXERCISES) {
    const row = {
      slug: ex.slug,
      name: ex.name,
      category: ex.category,
      pattern: ex.pattern,
      is_skill: !!ex.isSkill,
      default_unit: ex.defaultUnit ?? (ex.isSkill ? "seconds" : "reps"),
      equipment: ex.equipment,
      cues: ex.cues,
      demo_url: ex.demoUrl ?? null,
      owner_user_id: null,
    };

    const { data: existing } = await sb
      .from("exercise_library")
      .select("id")
      .is("owner_user_id", null)
      .eq("slug", ex.slug)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await sb
        .from("exercise_library")
        .update(row)
        .eq("id", existing.id);
      if (error) throw error;
      exerciseIdBySlug.set(ex.slug, existing.id as string);
      updated++;
    } else {
      const { data, error } = await sb
        .from("exercise_library")
        .insert(row)
        .select("id")
        .single();
      if (error) throw error;
      exerciseIdBySlug.set(ex.slug, data.id as string);
      created++;
    }
  }
  console.log(`  exercícios: ${created} criados, ${updated} atualizados.`);
}

// ── Skills + escadas ─────────────────────────────────────────────────
async function seedSkills() {
  let createdSkills = 0;
  let updatedSkills = 0;
  for (const sk of SKILLS) {
    const { data: existing } = await sb
      .from("skills")
      .select("id")
      .is("owner_user_id", null)
      .eq("slug", sk.slug)
      .maybeSingle();

    let skillId = existing?.id as string | undefined;
    if (skillId) {
      const { error } = await sb
        .from("skills")
        .update({ name: sk.name })
        .eq("id", skillId);
      if (error) throw error;
      updatedSkills++;
    } else {
      const { data, error } = await sb
        .from("skills")
        .insert({ slug: sk.slug, name: sk.name, owner_user_id: null })
        .select("id")
        .single();
      if (error) throw error;
      skillId = data.id as string;
      createdSkills++;
    }

    // Níveis: upsert por (skill_id, position). Idempotente.
    for (let position = 0; position < sk.levels.length; position++) {
      const lv = sk.levels[position];
      const { data: lvExisting } = await sb
        .from("skill_levels")
        .select("id")
        .eq("skill_id", skillId)
        .eq("position", position)
        .maybeSingle();

      const lvRow = { skill_id: skillId, position, name: lv.name };
      if (lvExisting?.id) {
        const { error } = await sb
          .from("skill_levels")
          .update(lvRow)
          .eq("id", lvExisting.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("skill_levels").insert(lvRow);
        if (error) throw error;
      }
    }
  }
  console.log(`  escadas: ${createdSkills} criadas, ${updatedSkills} atualizadas.`);
}

async function main() {
  console.log("Semeando biblioteca de exercícios (global)…");
  await seedExercises();
  console.log("Semeando escadas de skill (global)…");
  await seedSkills();
  console.log("✓ Seed de conteúdo concluído.");
}

main().catch((e) => {
  console.error("✗ Seed falhou:", e);
  process.exit(1);
});
