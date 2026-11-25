"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Screen } from "@/components/Screen";
import { destinationFor, useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

/** Écran 1 · Animation d'ouverture : le logo seul, puis la connexion (ou l'accueil si déjà connecté). */
export default function OpeningPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { ready, user, profile } = useAuth();
  const [animationDone, setAnimationDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimationDone(true), 1800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready && animationDone) router.replace(destinationFor(user, profile));
  }, [ready, animationDone, user, profile, router]);

  return (
    <Screen tone="white">
      <Link
        href="/connexion"
        aria-label={t("Continuer vers la connexion")}
        className="flex min-h-dvh flex-1 items-center justify-center overflow-hidden"
      >
        <Logo width={300} className="animate-pop" />
      </Link>
    </Screen>
  );
}
