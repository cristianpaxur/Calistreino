import { getActiveProgramRuntime } from "@/lib/programs";
import NoProgramCTA from "@/components/NoProgramCTA";
import TreinarPicker from "./TreinarPicker";

export const dynamic = "force-dynamic";

export default async function TreinarOverview() {
  const runtime = await getActiveProgramRuntime();

  return (
    <div className="px-[18px] pb-28 pt-14">
      {runtime.fromSeed && <NoProgramCTA variant="banner" />}
      <TreinarPicker days={runtime.days} />
    </div>
  );
}
