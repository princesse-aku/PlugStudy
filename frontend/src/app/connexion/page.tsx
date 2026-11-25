"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthTabs } from "@/components/AuthTabs";
import { Button } from "@/components/Button";
import { DemoBanner } from "@/components/DemoBanner";
import { Field, PasswordInput, TextInput } from "@/components/Field";
import { LockIcon } from "@/components/Icons";
import { Logo } from "@/components/Logo";
import { Screen } from "@/components/Screen";
import { destinationFor, useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

type Action = () => unknown;

/** Écran 2 · Connexion : e-mail et mot de passe, ou Google. */
export default function ConnexionPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { ready, user, profile, signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"email" | "google" | null>(null);

  // Un étudiant déjà connecté va directement à l'accueil (ou à l'onboarding s'il n'a pas de profil).
  useEffect(() => {
    if (ready && user) router.replace(destinationFor(user, profile));
  }, [ready, user, profile, router]);

  async function run(kind: "email" | "google", action: Action) {
    setError(null);
    setBusy(kind);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Une erreur est survenue. Réessaie.");
    } finally {
      setBusy(null);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Écris ton adresse e-mail et ton mot de passe.");
      return;
    }
    void run("email", () => signInWithEmail(email.trim(), password));
  }

  const errorId = error ? "connexion-error" : undefined;

  return (
    <Screen tone="white">
      <DemoBanner />
      <header className="flex flex-col items-center gap-3 px-6 pt-7">
        <Logo width={210} />
        <h1 className="text-center font-display text-[26px] font-bold leading-tight">{t("Connecte-toi pour commencer")}</h1>
      </header>

      <div className="flex flex-1 flex-col gap-3.5 px-6 pb-2 pt-4">
        <AuthTabs active="connexion" />

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
          <Field id="email" label={t("Adresse e-mail")}>
            <TextInput
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={"abc@gmail.com"}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-describedby={errorId}
            />
          </Field>

          <Field id="mdp" label={t("Mot de passe")}>
            <PasswordInput
              id="mdp"
              name="password"
              autoComplete="current-password"
              placeholder={t("Ton mot de passe")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby={errorId}
            />
          </Field>

          <Link
            href="/mot-de-passe-oublie"
            className="-mt-2 flex min-h-11 items-center self-end text-sm font-semibold text-deep"
          >
            {t("Mot de passe oublié ?")}
          </Link>

          {error ? (
            <p id="connexion-error" role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
              {t(error)}
            </p>
          ) : null}

          <Button type="submit" disabled={busy !== null} aria-busy={busy === "email"}>
            {busy === "email" ? t("Connexion…") : t("Se connecter")}
          </Button>
        </form>

        <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          {t("ou")}
          <span className="h-px flex-1 bg-line" />
        </div>

        <Button
          type="button"
          variant="secondary"
          disabled={busy !== null}
          aria-busy={busy === "google"}
          onClick={() => void run("google", signInWithGoogle)}
        >
          {busy === "google" ? t("Ouverture de Google…") : t("Continuer avec Google")}
        </Button>
      </div>

      <p className="flex items-center justify-center gap-2 px-6 pb-6 pt-2 text-center text-[13px] text-muted">
        <LockIcon size={18} />
        <span>{t("Tes cours restent privés. Tu peux supprimer ton compte à tout moment.")}</span>
      </p>
    </Screen>
  );
}
