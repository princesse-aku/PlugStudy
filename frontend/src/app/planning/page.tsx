import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { features } from "@/lib/features";

/** Provisoire : le planning (écrans 22, 23 et 29) est caché dans le MVP (voir lib/features.ts). */
export default function PlanningPage() {
  if (!features.planning) redirect("/accueil");
  return (
    <AppShell active="planning">
      <div className="px-5 pt-6">
        <h1 className="font-display text-[26px] font-bold leading-tight">Planning</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">Cet écran sera construit à l’une des prochaines étapes.</p>
      </div>
    </AppShell>
  );
}
