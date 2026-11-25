"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { DemoBanner } from "@/components/DemoBanner";
import { Field, Segmented, Select, TextInput, describedBy } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/lib/auth-context";
import { NIVEAUX, type Langue, type Niveau } from "@/lib/types";

const FILIERE_HINT = "Écris-la comme sur ton emploi du temps, par exemple Informatique ou Droit.";
const UNIVERSITE_HINT = "Par exemple UAC, UPM ou le nom de ton école.";

/** Écrans 6 et 7 · Onboarding : niveau (liste), filière et université (saisie libre), langue (facultative). */
export default function OnboardingPage() {
  const router = useRouter();
  const { ready, user, profile, saveProfile } = useAuth();
  const checked = useRef(false);

  const [niveau, setNiveau] = useState<Niveau>("Licence 1");
  const [filiere, setFiliere] = useState("");
  const [universite, setUniversite] = useState("");
  const [langue, setLangue] = useState<Langue>("fr");
  const [errors, setErrors] = useState<{ filiere?: string; universite?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);

  // Vérification faite une seule fois à l'arrivée : après l'enregistrement, le profil existe
  // et on ne veut pas renvoyer l'étudiant vers l'accueil avant la page « Préparation ».
  useEffect(() => {
    if (!ready || checked.current) return;
    checked.current = true;
    if (!user) router.replace("/connexion");
    else if (user.emailVerified === false) router.replace("/verification-email");
    else if (profile) router.replace("/accueil");
  }, [ready, user, profile, router]);

  if (!ready || !user) return <Screen />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!filiere.trim()) next.filiere = "Écris ta filière.";
    if (!universite.trim()) next.universite = "Écris ton université ou ton école.";
    setErrors(next);
    if (next.filiere || next.universite) return;

    setSaving(true);
    try {
      await saveProfile({ niveau, filiere: filiere.trim(), universite: universite.trim(), langue });
      router.push("/preparation");
    } catch {
      setErrors({ form: "Impossible d’enregistrer ton profil. Vérifie ta connexion et réessaie." });
      setSaving(false);
    }
  }

  return (
    <Screen>
      <DemoBanner />
      <header className="flex flex-col gap-2 px-6 pb-2 pt-7">
        <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-deep">Pour commencer</p>
        <h1 className="font-display text-[26px] font-bold leading-tight">Permets-nous de mieux te connaître</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          Trois choix pour adapter PlugStudy à tes cours. Tu pourras les modifier plus tard.
        </p>
      </header>

      <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-4 px-6 py-2">
          <Field id="niveau" label="Niveau d’étude">
            <Select id="niveau" name="niveau" value={niveau} onChange={(event) => setNiveau(event.target.value as Niveau)}>
              {NIVEAUX.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>

          <Field id="filiere" label="Filière" hint={FILIERE_HINT} error={errors.filiere}>
            <TextInput
              id="filiere"
              name="filiere"
              autoComplete="off"
              placeholder="Écris ta filière"
              value={filiere}
              onChange={(event) => setFiliere(event.target.value)}
              aria-invalid={errors.filiere ? true : undefined}
              aria-describedby={describedBy("filiere", FILIERE_HINT, errors.filiere)}
            />
          </Field>

          <Field id="universite" label="Université ou école" hint={UNIVERSITE_HINT} error={errors.universite}>
            <TextInput
              id="universite"
              name="universite"
              autoComplete="off"
              placeholder="Écris ton université ou ton école"
              value={universite}
              onChange={(event) => setUniversite(event.target.value)}
              aria-invalid={errors.universite ? true : undefined}
              aria-describedby={describedBy("universite", UNIVERSITE_HINT, errors.universite)}
            />
          </Field>

          <Segmented<Langue>
            label="Langue"
            optional
            value={langue}
            onChange={setLangue}
            options={[
              { value: "fr", label: "Français" },
              { value: "en", label: "English" },
            ]}
          />
        </div>

        <div className="flex flex-col gap-3 px-6 pb-6 pt-2">
          {errors.form ? (
            <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
              {errors.form}
            </p>
          ) : null}
          <Button type="submit" disabled={saving} aria-busy={saving}>
            {saving ? "Enregistrement…" : "Continuer"}
          </Button>
          <p className="text-center text-[13px] leading-relaxed text-muted">
            Ces informations servent à préparer des cours types pour ta filière.
          </p>
        </div>
      </form>
    </Screen>
  );
}
