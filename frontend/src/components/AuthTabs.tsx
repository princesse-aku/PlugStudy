import Link from "next/link";

/** Onglets « Se connecter » / « Créer un compte » en haut des écrans de compte. */
export function AuthTabs({ active }: { active: "connexion" | "inscription" }) {
  const tab = (on: boolean) =>
    `flex min-h-11 flex-1 items-center justify-center rounded-[10px] text-[15px] ${
      on ? "bg-card font-bold text-ink" : "font-medium text-muted"
    }`;
  return (
    <nav aria-label="Compte" className="flex gap-1 rounded-[14px] bg-pale p-1">
      <Link href="/connexion" aria-current={active === "connexion" ? "page" : undefined} className={tab(active === "connexion")}>
        Se connecter
      </Link>
      <Link
        href="/inscription"
        aria-current={active === "inscription" ? "page" : undefined}
        className={tab(active === "inscription")}
      >
        Créer un compte
      </Link>
    </nav>
  );
}
