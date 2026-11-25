"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { DemoBanner } from "@/components/DemoBanner";
import { Field, TextInput, describedBy } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/lib/auth-context";

/** Écran 5 · Mot de passe oublié : un champ e-mail et « Envoyer le lien ». */
export default function MotDePasseOubliePage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    setSentTo(null);
    if (!address) {
      setError("Écris ton adresse e-mail.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      setError("Cette adresse e-mail n’est pas valide.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await sendPasswordReset(address);
      setSentTo(address);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Une erreur est survenue. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen tone="white">
      <DemoBanner />
      <header className="flex flex-col gap-2 px-6 pt-7">
        <Link href="/connexion" className="-ml-1 flex min-h-11 items-center self-start text-sm font-semibold text-deep">
          ← Retour à la connexion
        </Link>
        <h1 className="font-display text-[26px] font-bold leading-tight">Mot de passe oublié</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          Écris l’adresse e-mail de ton compte. Nous t’envoyons un lien pour choisir un nouveau mot de passe.
        </p>
      </header>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5 px-6 pb-6 pt-5">
        <Field id="email" label="Adresse e-mail" error={error}>
          <TextInput
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="abc@gmail.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy("email", undefined, error)}
          />
        </Field>

        {sentTo ? (
          <p role="status" className="rounded-xl bg-pale px-4 py-3 text-sm leading-relaxed text-pale2">
            Si un compte existe avec {sentTo}, tu vas recevoir un lien dans quelques instants. Pense à regarder dans tes
            courriers indésirables.
          </p>
        ) : null}

        <Button type="submit" disabled={busy} aria-busy={busy}>
          {busy ? "Envoi…" : "Envoyer le lien"}
        </Button>
      </form>
    </Screen>
  );
}
