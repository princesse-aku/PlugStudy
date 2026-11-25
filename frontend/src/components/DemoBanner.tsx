"use client";

import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

/** Rappel visible tant que Firebase n'est pas configuré (développement seulement). */
export function DemoBanner() {
  const { demo } = useAuth();
  const { t } = useI18n();
  if (!demo) return null;
  return (
    <p role="status" className="bg-pale px-4 py-2 text-center text-[13px] leading-snug text-pale2">
      {t("Mode démo : Firebase n’est pas configuré, les données restent dans ce navigateur.")}
    </p>
  );
}
