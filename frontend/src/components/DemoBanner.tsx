"use client";

import { useAuth } from "@/lib/auth-context";

/** Rappel visible tant que Firebase n'est pas configuré (développement seulement). */
export function DemoBanner() {
  const { demo } = useAuth();
  if (!demo) return null;
  return (
    <p role="status" className="bg-pale px-4 py-2 text-center text-[13px] leading-snug text-pale2">
      Mode démo : Firebase n’est pas configuré, les données restent dans ce navigateur.
    </p>
  );
}
