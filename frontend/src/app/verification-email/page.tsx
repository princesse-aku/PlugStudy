"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { DemoBanner } from "@/components/DemoBanner";
import { Screen } from "@/components/Screen";
import { destinationFor, useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { maskEmail } from "@/lib/email";

const DELAI_RENVOI = 60;

function formatDelay(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Écran 4 · Vérifie ta boîte mail : Firebase envoie un lien (pas un code). */
export default function VerificationEmailPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { ready, user, profile, resendVerification, refreshUser, discardAccount } = useAuth();
  const [remaining, setRemaining] = useState(DELAI_RENVOI);
  const [busy, setBusy] = useState<"check" | "resend" | "change" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Personne de connecté : connexion. Adresse déjà confirmée : on passe à la suite.
  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/connexion");
    else if (user.emailVerified !== false) router.replace(destinationFor(user, profile));
  }, [ready, user, profile, router]);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  if (!ready || !user) return <Screen tone="white" />;

  async function onChecked() {
    setError(null);
    setInfo(null);
    setBusy("check");
    try {
      const verified = await refreshUser();
      if (!verified) {
        setError("Ton adresse n’est pas encore confirmée. Ouvre le lien reçu par e-mail, puis réessaie.");
      }
      // Si elle l'est, l'effet ci-dessus envoie l'étudiant vers l'onboarding.
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Une erreur est survenue. Réessaie.");
    } finally {
      setBusy(null);
    }
  }

  async function onResend() {
    setError(null);
    setInfo(null);
    setBusy("resend");
    try {
      await resendVerification();
      setRemaining(DELAI_RENVOI);
      setInfo("Lien renvoyé. Regarde ta boîte mail.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Une erreur est survenue. Réessaie.");
    } finally {
      setBusy(null);
    }
  }

  async function onChangeAddress() {
    setBusy("change");
    await discardAccount();
    router.push("/inscription");
  }

  return (
    <Screen tone="white">
      <DemoBanner />
      <div className="flex flex-1 flex-col gap-4 px-6 pb-6 pt-16">
        <h1 className="font-display text-[26px] font-bold leading-tight">{t("Vérifie ta boîte mail")}</h1>
        <p className="text-[15px] leading-relaxed text-ink">
          {t("Nous avons envoyé un lien de vérification à")}{" "}
          <strong className="font-semibold">{maskEmail(user.email)}</strong>. {t("Ouvre-le pour confirmer ton adresse.")}
        </p>
        <p className="text-sm leading-relaxed text-muted">
          {t("Tu ne vois rien ? Regarde dans tes courriers indésirables (spam).")}
        </p>

        {error ? (
          <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
            {t(error)}
          </p>
        ) : null}
        {info ? (
          <p role="status" className="rounded-xl bg-pale px-4 py-3 text-sm text-pale2">
            {t(info)}
          </p>
        ) : null}

        <div className="mt-2 flex flex-col gap-3">
          <Button type="button" onClick={() => void onChecked()} disabled={busy !== null} aria-busy={busy === "check"}>
            {busy === "check" ? t("Vérification…") : t("J’ai ouvert le lien")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void onResend()}
            disabled={busy !== null || remaining > 0}
            aria-busy={busy === "resend"}
          >
            {remaining > 0 ? t("Renvoyer le lien dans {delay}", { delay: formatDelay(remaining) }) : t("Renvoyer le lien")}
          </Button>
          <button
            type="button"
            onClick={() => void onChangeAddress()}
            disabled={busy !== null}
            className="flex min-h-11 items-center justify-center text-sm font-semibold text-deep disabled:opacity-60"
          >
            {t("Changer d’adresse e-mail")}
          </button>
        </div>
      </div>
    </Screen>
  );
}
