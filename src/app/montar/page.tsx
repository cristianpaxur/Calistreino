import { getExerciseCatalog } from "@/lib/programs";
import RoutineBuilder from "@/components/RoutineBuilder";

export const dynamic = "force-dynamic";

// Builder de rotina manual (006 / T-003,T-004). Carrega o catálogo (biblioteca
// real 005 OU fallback PLAN) no server e entrega ao builder client.
export default async function MontarPage() {
  const catalog = await getExerciseCatalog();
  return <RoutineBuilder catalog={catalog} />;
}
