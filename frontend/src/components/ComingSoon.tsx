import Link from "next/link";
import { Screen } from "./Screen";

/** Écran provisoire pour une page dont la maquette n'est pas encore construite. */
export function ComingSoon({ title, backHref, backLabel }: { title: string; backHref: string; backLabel: string }) {
  return (
    <Screen tone="white" className="px-6 pt-16">
      <h1 className="font-display text-[26px] font-bold leading-tight">{title}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">Cet écran sera construit à l’une des prochaines étapes.</p>
      <Link href={backHref} className="mt-6 flex min-h-11 items-center text-sm font-semibold text-deep">
        {backLabel}
      </Link>
    </Screen>
  );
}
