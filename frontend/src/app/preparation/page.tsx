"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { CheckIcon } from "@/components/Icons";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/lib/auth-context";
import { features } from "@/lib/features";
import { prepareTypicalCourses } from "@/lib/typical-courses";

type StepState = "done" | "run" | "todo";

function Step({ state, children }: { state: StepState; children: React.ReactNode }) {
  const icon =
    state === "done" ? (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
        <CheckIcon size={16} />
      </span>
    ) : state === "run" ? (
      <span className="h-6 w-6 shrink-0 rounded-full border-[3px] border-spark" />
    ) : (
      <span className="h-6 w-6 shrink-0 rounded-full border-2 border-[#9aa8a0]" />
    );
  return (
    <li
      aria-current={state === "run" ? "step" : undefined}
      className={`flex items-center gap-3 text-[15px] ${state === "run" ? "font-semibold" : ""} ${
        state === "todo" ? "text-muted" : "text-ink"
      }`}
    >
      {icon}
      <span>{children}</span>
      <span className="sr-only">{state === "done" ? " (terminé)" : state === "run" ? " (en cours)" : " (à venir)"}</span>
    </li>
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Écran 8 · Préparation de l'espace : profil créé, cours types, tableau de bord. */
export default function PreparationPage() {
  const router = useRouter();
  const { ready, user, profile } = useAuth();
  const started = useRef(false);
  // 0 = préparation des cours types, 1 = tableau de bord, 2 = terminé
  const [phase, setPhase] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/connexion");
    else if (!profile) router.replace("/onboarding");
  }, [ready, user, profile, router]);

  useEffect(() => {
    if (!ready || !profile || started.current) return;
    started.current = true;
    let cancelled = false;
    (async () => {
      // La pause minimale laisse lire les étapes ; la préparation réelle vient du catalogue de cours types.
      await Promise.all([features.typicalCourses ? prepareTypicalCourses(profile) : Promise.resolve(), sleep(900)]);
      if (cancelled) return;
      setPhase(1);
      await sleep(600);
      if (cancelled) return;
      setPhase(2);
    })();
    return () => {
      cancelled = true;
      started.current = false;
    };
  }, [ready, profile]);

  if (!ready || !profile) return <Screen />;

  const progress = phase === 0 ? 33 : phase === 1 ? 66 : 100;

  return (
    <Screen>
      <div className="flex flex-1 flex-col gap-5 px-6 pt-16">
        <h1 className="font-display text-[28px] font-bold leading-tight">Ton espace se prépare</h1>
        <p className="text-[15px] text-muted">
          {profile.niveau} · {profile.filiere} · {profile.universite}
        </p>

        <div
          role="progressbar"
          aria-label="Préparation de ton espace"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-2 overflow-hidden rounded bg-pale"
        >
          <div className="h-2 bg-accent transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>

        <ol aria-live="polite" className="flex flex-col gap-3.5 rounded-2xl border border-line bg-card p-4">
          <Step state="done">Profil créé</Step>
          <Step state={phase === 0 ? "run" : "done"}>
            {features.typicalCourses ? `Préparation des cours types : ${profile.filiere}, ${profile.niveau}` : "Préparation de ton espace"}
          </Step>
          <Step state={phase === 0 ? "todo" : phase === 1 ? "run" : "done"}>Ton tableau de bord</Step>
        </ol>

        <p className="rounded-[14px] bg-pale px-4 py-3.5 text-sm leading-relaxed text-pale2">
          {features.typicalCourses
            ? "Les cours types sont une base de départ. Tu peux déposer tes propres cours à tout moment."
            : "Ton espace est vide pour l’instant : dépose ton premier cours et l’IA le lira pour toi."}
        </p>
      </div>

      <div className="px-6 pb-6 pt-2">
        {phase === 2 ? (
          <ButtonLink href="/accueil">Aller à l’accueil</ButtonLink>
        ) : (
          <Button type="button" disabled>
            Aller à l’accueil
          </Button>
        )}
      </div>
    </Screen>
  );
}
