"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Field, Segmented, Select, TextInput, describedBy } from "@/components/Field";
import { LogoutIcon } from "@/components/Icons";
import { useAuth } from "@/lib/auth-context";
import { features } from "@/lib/features";
import { NIVEAUX, type Langue, type Niveau, type Profile } from "@/lib/types";

const FILIERE_HINT = "Écris-la comme sur ton emploi du temps, par exemple Informatique ou Droit.";

function initials(name: string | null, email: string | null): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) return words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join("");
  return (email ?? "?").charAt(0).toUpperCase();
}

function ProfilForm({ profile }: { profile: Profile }) {
  const { user, saveProfile, updateName } = useAuth();
  const [name, setName] = useState(user?.displayName ?? "");
  const [niveau, setNiveau] = useState<Niveau>(profile.niveau);
  const [filiere, setFiliere] = useState(profile.filiere);
  const [universite, setUniversite] = useState(profile.universite);
  const [langue, setLangue] = useState<Langue>(profile.langue);
  const [errors, setErrors] = useState<{ nom?: string; filiere?: string; universite?: string; form?: string }>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty =
    name.trim() !== (user?.displayName ?? "") ||
    niveau !== profile.niveau ||
    filiere.trim() !== profile.filiere ||
    universite.trim() !== profile.universite ||
    langue !== profile.langue;

  function touch<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setSaved(false);
    };
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.nom = "Écris ton nom.";
    if (!filiere.trim()) next.filiere = "Écris ta filière.";
    if (!universite.trim()) next.universite = "Écris ton université ou ton école.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await saveProfile({ niveau, filiere: filiere.trim(), universite: universite.trim(), langue });
      if (name.trim() !== (user?.displayName ?? "")) await updateName(name.trim());
      setSaved(true);
    } catch {
      setErrors({ form: "Impossible d’enregistrer tes modifications. Vérifie ta connexion et réessaie." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5 px-5 pt-3">
      <Field id="nom" label="Nom complet" error={errors.nom}>
        <TextInput
          id="nom"
          autoComplete="name"
          placeholder="Prénom et nom"
          value={name}
          onChange={(event) => touch(setName)(event.target.value)}
          aria-invalid={errors.nom ? true : undefined}
          aria-describedby={describedBy("nom", undefined, errors.nom)}
        />
      </Field>

      <Field id="niveau" label="Niveau d’étude">
        <Select id="niveau" value={niveau} onChange={(event) => touch(setNiveau)(event.target.value as Niveau)}>
          {NIVEAUX.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </Field>

      <Field id="filiere" label="Filière" hint={FILIERE_HINT} error={errors.filiere}>
        <TextInput
          id="filiere"
          autoComplete="off"
          placeholder="Écris ta filière"
          value={filiere}
          onChange={(event) => touch(setFiliere)(event.target.value)}
          aria-invalid={errors.filiere ? true : undefined}
          aria-describedby={describedBy("filiere", FILIERE_HINT, errors.filiere)}
        />
      </Field>

      <Field id="universite" label="Université ou école" error={errors.universite}>
        <TextInput
          id="universite"
          autoComplete="off"
          placeholder="Écris ton université ou ton école"
          value={universite}
          onChange={(event) => touch(setUniversite)(event.target.value)}
          aria-invalid={errors.universite ? true : undefined}
          aria-describedby={describedBy("universite", undefined, errors.universite)}
        />
      </Field>

      <Segmented
        label="Langue"
        value={langue}
        onChange={touch(setLangue)}
        options={[
          { value: "fr", label: "Français" },
          { value: "en", label: "English" },
        ]}
      />

      {errors.form ? (
        <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
          {errors.form}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="rounded-xl bg-pale px-4 py-3 text-sm text-pale2">
          Modifications enregistrées.
        </p>
      ) : null}

      <Button type="submit" disabled={!dirty || saving} aria-busy={saving}>
        {saving ? "Enregistrement…" : "Enregistrer les modifications"}
      </Button>
    </form>
  );
}

/** Écran 25 · Profil : nom, niveau, filière, université, langue ; déconnexion et suppression du compte. */
export default function ProfilPage() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();

  return (
    <AppShell active="profil">
      <header className="px-5 pb-1 pt-6">
        <h1 className="font-display text-[26px] font-bold leading-tight">Profil</h1>
      </header>

      <div className="flex items-center gap-4 px-5 pt-3">
        <div
          aria-hidden="true"
          className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-pale font-display text-2xl font-bold text-pale2"
        >
          {initials(user?.displayName ?? null, user?.email ?? null)}
        </div>
        <div className="flex min-w-0 flex-col">
          <p className="truncate font-display text-lg font-bold">{user?.displayName ?? "Ton profil"}</p>
          <p className="truncate text-sm text-muted">{user?.email}</p>
          {features.profilePhoto ? (
            <button
              type="button"
              disabled
              title="Bientôt disponible"
              className="flex min-h-11 items-center self-start text-sm font-semibold text-muted opacity-70"
            >
              Changer la photo
            </button>
          ) : null}
        </div>
      </div>

      {profile ? <ProfilForm profile={profile} /> : null}

      <div className="flex flex-col gap-1 px-5 pt-5">
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.replace("/connexion");
          }}
          className="flex min-h-12 items-center justify-center gap-2 rounded-[14px] border border-line bg-card text-base font-semibold text-ink"
        >
          <LogoutIcon />
          Se déconnecter
        </button>
        {features.deleteAccount ? (
          <Link href="/profil/suppression" className="flex min-h-11 items-center justify-center text-sm font-semibold text-danger">
            Supprimer mon compte
          </Link>
        ) : null}
      </div>
    </AppShell>
  );
}
