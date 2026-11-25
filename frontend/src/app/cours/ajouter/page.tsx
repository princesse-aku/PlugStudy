"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { DemoBanner } from "@/components/DemoBanner";
import { Field, Select, TextInput, describedBy } from "@/components/Field";
import {
  CalendarIcon,
  ChevronLeftIcon,
  CheckIcon,
  CircleCheckIcon,
  FileIcon,
  UploadIcon,
} from "@/components/Icons";
import { Screen } from "@/components/Screen";
import { useRequireStudent } from "@/lib/auth-context";
import { sendCourseFile } from "@/lib/api";
import { backend } from "@/lib/backend";
import { useI18n } from "@/lib/i18n";
import { extensionOf, nameFromFile } from "@/lib/courses";
import { fileSizeLabel } from "@/lib/time";
import { CATEGORIES, COURSE_EXTENSIONS, type Category, type Profile } from "@/lib/types";

const FORMAT_ERROR = "Ce format n’est pas pris en charge. Choisis un PDF, DOCX, PPT ou TXT.";

/** Catégorie proposée d'après la filière de l'étudiant (la détection par l'IA viendra avec le backend). */
function guessCategory(profile: Profile | null): Category {
  const filiere = (profile?.filiere ?? "").toLowerCase();
  if (/info|logiciel|programm/.test(filiere)) return "Informatique";
  if (/math/.test(filiere)) return "Mathématiques";
  if (/r[ée]seau|t[ée]l[ée]com/.test(filiere)) return "Réseaux";
  if (/compta|gestion|finance/.test(filiere)) return "Comptabilité";
  if (/droit|juridi/.test(filiere)) return "Droit";
  return "Autre";
}

function AiPrepares() {
  const { t } = useI18n();
  const items = [
    { label: t("Fiche résumée"), Icon: FileIcon },
    { label: t("Quiz"), Icon: CircleCheckIcon },
    { label: t("Plan de révision"), Icon: CalendarIcon },
  ];
  return (
    <section aria-labelledby="ia" className="flex flex-col gap-3 rounded-2xl border border-line bg-card px-4 py-3.5">
      <h2 id="ia" className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted">
        {t("Ce que l’IA prépare")}
      </h2>
      <ul className="grid grid-cols-3 gap-2">
        {items.map(({ label, Icon }) => (
          <li key={label} className="flex flex-col items-center gap-1.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-pale text-pale2">
              <Icon size={20} />
            </span>
            <span className="text-center text-[13px] font-semibold leading-snug">{label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Écrans 11 · Ajouter un cours (dépôt) et 12 · fichier choisi (nom, description, catégorie). */
export default function AjouterCoursPage() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const { ok, user, profile } = useRequireStudent();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>(() => guessCategory(profile));
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!ok || !user) return <Screen />;
  const nomHint = t("Nom proposé d’après le fichier. Tu peux le changer.");

  function choose(picked: File | undefined) {
    if (!picked) return;
    if (!(COURSE_EXTENSIONS as readonly string[]).includes(extensionOf(picked.name))) {
      setFileError(FORMAT_ERROR);
      return;
    }
    setFileError(null);
    setFile(picked);
    setName(nameFromFile(picked.name));
    setCategory(guessCategory(profile));
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !name.trim() || !user) return;
    setSaving(true);
    setFormError(null);
    try {
      const courseId = await backend.createCourse(user, {
        name: name.trim(),
        description: description.trim(),
        category,
        fileName: file.name,
        fileSize: file.size,
      });
      // Le backend lit le fichier et prépare fiche, notions et quiz ; sans backend branché, le cours reste en préparation.
      try {
        await sendCourseFile(courseId, file, lang);
      } catch {
        await backend.setDocument(["users", user.uid, "courses", courseId], { status: "error", errorReason: "upload" }, true);
        router.push(`/cours/${courseId}`);
        return;
      }
      router.push("/cours?ajoute=1");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Une erreur est survenue. Réessaie.");
      setSaving(false);
    }
  }

  const back = file ? (
    <button
      type="button"
      aria-label={t("Retour")}
      onClick={() => setFile(null)}
      className="flex h-11 w-11 items-center justify-center"
    >
      <ChevronLeftIcon />
    </button>
  ) : (
    <Link href="/cours" aria-label={t("Retour")} className="flex h-11 w-11 items-center justify-center">
      <ChevronLeftIcon />
    </Link>
  );

  return (
    <Screen>
      <DemoBanner />
      <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col">
        <header className="flex items-center gap-2 px-2 pb-2 pt-3">
          {back}
          <div className="flex flex-col">
            <h1 className="font-display text-lg font-bold">{t("Ajouter un cours")}</h1>
            <p className="text-[13px] text-muted">
              {file ? t("Vérifie, puis crée ton cours.") : t("Dépose ton fichier, PlugStudy prépare le reste.")}
            </p>
          </div>
        </header>

        <input
          ref={input}
          type="file"
          accept=".pdf,.docx,.ppt,.pptx,.txt"
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="fichier"
          onChange={(event) => {
            choose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        <div className="flex flex-1 flex-col gap-4 px-5 pt-2">
          {file ? (
            <>
              <div className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3.5">
                <span className="text-pale2">
                  <FileIcon size={28} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="break-words text-base font-semibold">{file.name}</span>
                  <span className="text-[13px] text-muted">{fileSizeLabel(file.size, lang)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  className="flex min-h-11 items-center px-1 text-sm font-semibold text-deep"
                >
                  {t("Changer")}
                </button>
              </div>

              <Field id="nom" label={t("Nom du cours")} hint={nomHint}>
                <TextInput
                  id="nom"
                  autoComplete="off"
                  placeholder={t("Nom du cours")}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  aria-describedby={describedBy("nom", nomHint)}
                />
              </Field>

              <Field id="desc" label={t("Description")} optional>
                <TextInput
                  id="desc"
                  autoComplete="off"
                  placeholder={t("Une ligne pour te rappeler de quoi il s’agit")}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Field>

              <div className="flex flex-col gap-2">
                <label htmlFor="categorie" className="text-sm font-semibold">
                  {t("Catégorie")}
                </label>
                <Select id="categorie" value={category} onChange={(event) => setCategory(event.target.value as Category)}>
                  {CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {t(item)}
                    </option>
                  ))}
                </Select>
                <p className="flex items-center gap-1.5 text-[13px] leading-snug text-muted">
                  <span className="text-pale2">
                    <CheckIcon size={16} />
                  </span>
                  {t("Choisie d’après ta filière. Tu peux la changer.")}
                </p>
              </div>
            </>
          ) : (
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed bg-card px-4 pb-5 pt-7 text-center ${
                dragging ? "border-accent" : "border-line"
              }`}
            >
              <span className="text-pale2">
                <UploadIcon size={32} />
              </span>
              <h2 className="font-display text-lg font-bold">{t("Dépose ton fichier de cours")}</h2>
              <p className="text-sm leading-relaxed text-muted">{t("PDF, DOCX, PPT ou TXT")}</p>
              <div className="mt-1.5 self-stretch">
                <Button type="button" variant="secondary" onClick={() => input.current?.click()}>
                  {t("Ajouter un fichier")}
                </Button>
              </div>
              {fileError ? (
                <p role="alert" className="text-[13px] leading-snug text-danger">
                  {t(fileError)}
                </p>
              ) : null}
            </div>
          )}

          <AiPrepares />

          {formError ? (
            <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
              {t(formError)}
            </p>
          ) : null}
        </div>

        <div className="px-5 pb-6 pt-2">
          <Button type="submit" disabled={!file || !name.trim() || saving} aria-busy={saving}>
            {saving ? t("Création…") : t("Créer le cours")}
          </Button>
        </div>
      </form>
    </Screen>
  );
}
