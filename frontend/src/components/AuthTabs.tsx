"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

/** Onglets « Se connecter » / « Créer un compte » en haut des écrans de compte. */
export function AuthTabs({ active }: { active: "connexion" | "inscription" }) {
  const { t } = useI18n();
  const tab = (on: boolean) =>
    `flex min-h-11 flex-1 items-center justify-center rounded-[10px] text-[15px] ${
      on ? "bg-card font-bold text-ink" : "font-medium text-muted"
    }`;
  return (
    <nav aria-label={t("Compte")} className="flex gap-1 rounded-[14px] bg-pale p-1">
      <Link href="/connexion" aria-current={active === "connexion" ? "page" : undefined} className={tab(active === "connexion")}>
        {t("Se connecter")}
      </Link>
      <Link
        href="/inscription"
        aria-current={active === "inscription" ? "page" : undefined}
        className={tab(active === "inscription")}
      >
        {t("Créer un compte")}
      </Link>
    </nav>
  );
}
