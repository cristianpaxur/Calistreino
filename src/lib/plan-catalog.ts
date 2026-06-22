// Catálogo de slugs para a geração de plano (008). PURO (sem IO).
//
// O gerador (plan-generator) precisa de um SlugCatalog: slug → { id, name,
// equipment }. Há duas fontes:
//   • banco (005 aplicado): programs.ts::getSlugCatalog() lê exercise_library;
//   • offline/fallback: buildSeedCatalog() deriva dos seeds curados (exercises.ts).
//
// Este módulo provê só a fonte OFFLINE (testável sem rede). A função do banco
// fica em programs.ts (IO). Como os seeds têm id null, o draft gerado a partir do
// catálogo de seed usa exercise_name (nome livre) — o que o runtime 004 já
// tolera; ao aplicar 005, o catálogo do banco traz os ids reais.

import type { SlugCatalog } from "./plan-generator.ts";
import { EXERCISES } from "../../supabase/seeds/exercises.ts";

/** Catálogo derivado dos seeds curados (offline). id=null (sem banco). */
export function buildSeedCatalog(): SlugCatalog {
  const map: SlugCatalog = new Map();
  for (const ex of EXERCISES) {
    map.set(ex.slug, {
      id: null,
      name: ex.name,
      // só consideramos equipamento "real" (ignora floor/wall/bench que são
      // quase universais) para a checagem de viabilidade do slot.
      equipment: ex.equipment.filter((e) =>
        ["bar", "rings", "parallettes", "dip-bar", "band"].includes(e)
      ),
    });
  }
  return map;
}
