"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthTabs } from "@/components/AuthTabs";
import { Button } from "@/components/Button";
import { DemoBanner } from "@/components/DemoBanner";
import { Field, PasswordInput, TextInput, describedBy } from "@/components/Field";
import { Logo } from "@/components/Logo";
import { Screen } from "@/components/Screen";
import { destinationFor, useAuth } from "@/lib/auth-context";

const MOT_DE_PASSE_MIN = 8;
const PASSWORD_HINT = "8 caractères minimum.";

interface Errors {
  nom?: string;
  email?: string;
  password?: string;
  conditions?: string;
  form?: string;
}

/** Écran 3 · Créer un compte : nom, e-mail, mot de passe, conditions, ou Google. */
export default function InscriptionPage() {
  const router = useRouter();
  const { ready, user, profile, signUpWithEmail, signInWithGoogle } = useAuth();
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [conditions, setConditions] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState<"email" | "google" | null>(null);

  // Une fois le compte créé (ou si l'étudiant est déjà connecté), on passe à la suite :
  // vérification de l'e-mail, onboarding ou accueil.
  useEffect(() => {
    if (ready && user) router.replace(destinationFor(user, profile));
  }, [ready, user, profile, router]);

  async function run(kind: "email" | "google", action: () => Promise<void>) {
    setErrors((current) => ({ ...current, form: undefined }));
    setBusy(kind);
    try {
      await action();
    } catch (caught) {
      setErrors({ form: caught instanceof Error ? caught.message : "Une erreur est survenue. Réessaie." });
    } finally {
      setBusy(null);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Errors = {};
    if (!nom.trim()) next.nom = "Écris ton nom complet.";
    if (!email.trim()) next.email = "Écris ton adresse e-mail.";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Cette adresse e-mail n’est pas valide.";
    if (password.length < MOT_DE_PASSE_MIN) next.password = "Ton mot de passe doit avoir au moins 8 caractères.";
    if (!conditions) next.conditions = "Accepte les conditions d’utilisation pour continuer.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    void run("email", () => signUpWithEmail(nom.trim(), email.trim(), password));
  }

  return (
    <Screen tone="white">
      <DemoBanner />
      <header className="flex flex-col items-center gap-3 px-6 pt-7">
        <Logo width={210} />
        <h1 className="text-center font-display text-[26px] font-bold leading-tight">Crée ton compte</h1>
      </header>

      <div className="flex flex-1 flex-col gap-3.5 px-6 pb-6 pt-4">
        <AuthTabs active="inscription" />

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
          <Field id="nom" label="Nom complet" error={errors.nom}>
            <TextInput
              id="nom"
              name="name"
              autoComplete="name"
              placeholder="Prénom et nom"
              value={nom}
              onChange={(event) => setNom(event.target.value)}
              aria-invalid={errors.nom ? true : undefined}
              aria-describedby={describedBy("nom", undefined, errors.nom)}
            />
          </Field>

          <Field id="email" label="Adresse e-mail" error={errors.email}>
            <TextInput
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="abc@gmail.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={describedBy("email", undefined, errors.email)}
            />
          </Field>

          <Field id="mdp" label="Mot de passe" hint={PASSWORD_HINT} error={errors.password}>
            <PasswordInput
              id="mdp"
              name="password"
              autoComplete="new-password"
              placeholder="Choisis un mot de passe"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={describedBy("mdp", PASSWORD_HINT, errors.password)}
            />
          </Field>

          <div className="flex flex-col gap-1">
            <label htmlFor="conditions" className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
              <input
                id="conditions"
                type="checkbox"
                checked={conditions}
                onChange={(event) => setConditions(event.target.checked)}
                aria-invalid={errors.conditions ? true : undefined}
                aria-describedby={errors.conditions ? "conditions-error" : undefined}
                className="h-6 w-6 shrink-0 accent-accent"
              />
              J’accepte les conditions d’utilisation
            </label>
            {errors.conditions ? (
              <p id="conditions-error" role="alert" className="text-[13px] leading-snug text-danger">
                {errors.conditions}
              </p>
            ) : null}
          </div>

          {errors.form ? (
            <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
              {errors.form}
            </p>
          ) : null}

          <Button type="submit" disabled={busy !== null} aria-busy={busy === "email"}>
            {busy === "email" ? "Création du compte…" : "Créer mon compte"}
          </Button>
        </form>

        <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          ou
          <span className="h-px flex-1 bg-line" />
        </div>

        <Button
          type="button"
          variant="secondary"
          disabled={busy !== null}
          aria-busy={busy === "google"}
          onClick={() => void run("google", signInWithGoogle)}
        >
          {busy === "google" ? "Ouverture de Google…" : "Continuer avec Google"}
        </Button>

        <p className="flex flex-wrap items-center justify-center gap-x-1.5 text-sm text-muted">
          Tu as déjà un compte ?
          <Link href="/connexion" className="flex min-h-11 items-center font-semibold text-deep">
            Se connecter
          </Link>
        </p>
      </div>
    </Screen>
  );
}
