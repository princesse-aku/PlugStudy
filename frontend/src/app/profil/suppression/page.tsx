"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DemoBanner } from "@/components/DemoBanner";
import { Field, TextInput, describedBy } from "@/components/Field";
import { BackHeader } from "@/components/Revision";
import { Screen } from "@/components/Screen";
import { useRequireStudent } from "@/lib/auth-context";
import { backend, UserFacingError } from "@/lib/backend";
import { useI18n } from "@/lib/i18n";
import { useFeatureGate } from "@/lib/use-feature-gate";

/** Ce qui disparaît avec le compte (écran 31 : « Tout sera supprimé »). */
const LOST = [
  "Tes cours et leurs fichiers",
  "Tes fiches, tes notions et tes quiz",
  "Ton planning",
  "Tes conversations avec l’assistant",
  "Ton profil et ton adresse e-mail",
] as const;

/** Écran 31 · Supprimer mon compte : on écrit SUPPRIMER pour débloquer « Supprimer définitivement ». */
export default function SuppressionComptePage() {
  const router = useRouter();
  const { t } = useI18n();
  const enabled = useFeatureGate("deleteAccount", "/profil");
  const { ok, user } = useRequireStudent();
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled || !ok || !user) return <Screen />;

  const word = t("SUPPRIMER");
  const confirmed = typed.trim().toLocaleUpperCase() === word;
  const hint = t("Cette action est définitive : tes données ne pourront pas être récupérées.");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed || deleting || !user) return;
    setDeleting(true);
    setError(null);
    try {
      await backend.deleteAccount(user);
      router.replace("/connexion");
    } catch (caught) {
      setError(caught instanceof UserFacingError ? caught.message : "Impossible de supprimer ton compte pour le moment. Réessaie dans un instant.");
      setDeleting(false);
    }
  }

  return (
    <Screen>
      <DemoBanner />
      <BackHeader href="/profil" title={t("Supprimer mon compte")} />
      <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col gap-4 px-5 pt-2">
        <section role="alert" className="flex flex-col gap-2.5 rounded-2xl border-2 border-danger bg-danger-bg px-4 py-[18px]">
          <h2 className="font-display text-xl font-bold text-danger">{t("Tout sera supprimé")}</h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] leading-snug">
            {LOST.map((item) => (
              <li key={item}>{t(item)}</li>
            ))}
          </ul>
        </section>

        <Field id="confirmation" label={t("Pour confirmer, écris {mot}", { mot: word })} hint={hint}>
          <TextInput
            id="confirmation"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder={word}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            aria-describedby={describedBy("confirmation", hint)}
          />
        </Field>

        {error ? (
          <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
            {t(error)}
          </p>
        ) : null}

        <div className="mt-auto flex flex-col gap-2 pb-6 pt-2">
          <button
            type="submit"
            disabled={!confirmed || deleting}
            aria-busy={deleting}
            className="flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-danger px-4 text-base font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-danger-bg disabled:text-muted"
          >
            {deleting ? t("Suppression…") : t("Supprimer définitivement")}
          </button>
          <Link href="/profil" className="flex min-h-12 items-center justify-center text-base font-semibold text-deep">
            {t("Annuler")}
          </Link>
        </div>
      </form>
    </Screen>
  );
}
