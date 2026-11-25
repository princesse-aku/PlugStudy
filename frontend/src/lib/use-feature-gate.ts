"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { features, type Feature } from "@/lib/features";

/** Renvoie l'étudiant vers `fallback` si la fonction est cachée (adresse tapée à la main ou ancien lien). */
export function useFeatureGate(feature: Feature, fallback: string): boolean {
  const router = useRouter();
  const enabled = features[feature];
  useEffect(() => {
    if (!enabled) router.replace(fallback);
  }, [enabled, fallback, router]);
  return enabled;
}
