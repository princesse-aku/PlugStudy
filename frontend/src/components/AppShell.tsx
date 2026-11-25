"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { DemoBanner } from "@/components/DemoBanner";
import { BarsIcon, BookIcon, CalendarIcon, HomeIcon, PlusIcon, UserIcon } from "@/components/Icons";
import { Screen } from "@/components/Screen";
import { useRequireStudent } from "@/lib/auth-context";
import { features } from "@/lib/features";
import { useI18n } from "@/lib/i18n";

export type NavItem = "accueil" | "cours" | "planning" | "suivi" | "profil";

const ALL_ITEMS: { id: NavItem; label: string; href: string; Icon: typeof HomeIcon }[] = [
  { id: "accueil", label: "Accueil", href: "/accueil", Icon: HomeIcon },
  { id: "cours", label: "Cours", href: "/cours", Icon: BookIcon },
  { id: "planning", label: "Planning", href: "/planning", Icon: CalendarIcon },
  { id: "suivi", label: "Suivi", href: "/suivi", Icon: BarsIcon },
  { id: "profil", label: "Profil", href: "/profil", Icon: UserIcon },
];

/** Les entrées visibles : Planning et Suivi sont cachés dans le MVP (voir lib/features.ts). */
const ITEMS = ALL_ITEMS.filter((item) => (item.id === "planning" ? features.planning : item.id === "suivi" ? features.suivi : true));

/** Barre du bas : Accueil, Cours, Profil (et Planning, Suivi quand ils sont rallumés). */
export function BottomNav({ active }: { active: NavItem }) {
  const { t } = useI18n();
  return (
    <nav aria-label={t("Navigation principale")} className="flex border-t border-line bg-card px-3 pb-2.5 pt-1.5">
      {ITEMS.map(({ id, label, href, Icon }) => {
        const on = id === active;
        return (
          <Link
            key={id}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 ${on ? "text-deep" : "text-muted"}`}
          >
            <span className={`h-[3px] w-7 rounded-sm ${on ? "bg-accent" : ""}`} aria-hidden="true" />
            <Icon />
            <span className={`text-xs ${on ? "font-bold" : "font-medium"}`}>{t(label)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Cadre des écrans de l'application : zone qui défile, barre du bas, et bouton « Ajouter un cours »
 * (rond sur l'accueil, avec texte sur la liste des cours). Il renvoie aussi l'étudiant vers la connexion,
 * la vérification de l'e-mail ou l'onboarding si besoin.
 */
export function AppShell({
  active,
  fab,
  children,
}: {
  active: NavItem;
  fab?: "round" | "pill";
  children: ReactNode;
}) {
  const { ok } = useRequireStudent();
  const { t } = useI18n();
  if (!ok) return <Screen app />;

  return (
    <Screen app>
      <DemoBanner />
      <div className={`min-h-0 flex-1 overflow-y-auto ${fab ? "pb-32" : "pb-6"}`}>{children}</div>
      {fab ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-[88px] flex justify-center">
          <Link
            href="/cours/ajouter"
            aria-label={fab === "round" ? t("Ajouter un cours") : undefined}
            className={`pointer-events-auto flex items-center justify-center bg-accent text-on-accent shadow-lg hover:bg-deep ${
              fab === "round" ? "h-[60px] w-[60px] rounded-full" : "min-h-14 gap-2 rounded-full px-6 text-base font-bold"
            }`}
          >
            <PlusIcon size={fab === "round" ? 30 : 22} />
            {fab === "pill" ? t("Ajouter un cours") : null}
          </Link>
        </div>
      ) : null}
      <BottomNav active={active} />
    </Screen>
  );
}
