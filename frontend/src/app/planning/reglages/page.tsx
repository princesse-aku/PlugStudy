"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { DemoBanner } from "@/components/DemoBanner";
import { Field, Segmented, Select, TextInput, describedBy } from "@/components/Field";
import { CalendarIcon } from "@/components/Icons";
import { BackHeader, Notice } from "@/components/Revision";
import { Screen } from "@/components/Screen";
import { useRequireStudent } from "@/lib/auth-context";
import { savePlan, usePlans } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import {
  DEFAULT_STUDY_MINUTES,
  STUDY_MINUTES,
  addDays,
  durationLabel,
  isISODate,
  sessionCount,
  sessionCountLabel,
  shortDate,
  todayISO,
} from "@/lib/planning";
import { useFeatureGate } from "@/lib/use-feature-gate";
import { useCourses } from "@/lib/use-courses";

/** Écran 22 · Planning, réglages : le cours, la date de l'examen (saisie une seule fois) et le temps par jour. */
function Reglages() {
  const router = useRouter();
  const { ok, user } = useRequireStudent();
  const { t, lang } = useI18n();
  const enabled = useFeatureGate("planning", "/accueil");
  const wanted = useSearchParams().get("cours");
  const { courses: all, loaded } = useCourses(user?.uid);
  const { plans } = usePlans(user?.uid);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [examDate, setExamDate] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled || !ok || !user) return <Screen />;

  // Seuls les cours prêts ont des notions à découper.
  const courses = all.filter((item) => item.status === "ready");
  const course = courses.find((item) => item.id === (courseId ?? wanted)) ?? courses[0];
  const previous = plans.find((plan) => plan.courseId === course?.id) ?? null;
  // Tant que l'étudiant n'a rien changé, les champs montrent ce qui est déjà réglé pour ce cours.
  const date = examDate ?? previous?.examDate ?? course?.examDate ?? "";
  const perDay = minutes ?? previous?.minutes ?? course?.studyMinutes ?? DEFAULT_STUDY_MINUTES;
  const today = todayISO();
  const valid = isISODate(date) && date > today;
  const count = valid ? sessionCount(today, date) : 0;
  const dateError = date && !valid ? t("La date de l’examen doit être après aujourd’hui.") : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !course || !valid) return;
    setSaving(true);
    setError(null);
    try {
      await savePlan(user, course, { examDate: date, minutes: perDay }, previous);
      router.push("/planning");
    } catch {
      setError(t("Impossible d’enregistrer ton planning. Vérifie ta connexion et réessaie."));
      setSaving(false);
    }
  }

  return (
    <Screen>
      <DemoBanner />
      <BackHeader href="/planning" title={t("Ton planning")} subtitle={t("Deux réglages, une seule fois.")} />

      {loaded && courses.length === 0 ? (
        <div className="flex flex-1 flex-col gap-4 px-5 pt-2">
          <Notice>{t("Ajoute d’abord un cours et attends qu’il soit prêt : le planning découpe son contenu en sessions.")}</Notice>
          <ButtonLink href="/cours/ajouter">{t("Ajouter un cours")}</ButtonLink>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col gap-4 px-5 pt-2">
          <Field id="cours" label={t("Pour quel cours ?")}>
            <Select
              id="cours"
              value={course?.id ?? ""}
              onChange={(event) => {
                setCourseId(event.target.value);
                setExamDate(null);
                setMinutes(null);
              }}
            >
              {courses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            id="examen"
            label={t("Date de l’examen")}
            hint={t("Tu l’entres une seule fois. Tu pourras la changer.")}
            error={dateError}
          >
            <TextInput
              id="examen"
              type="date"
              min={addDays(today, 1)}
              value={date}
              onChange={(event) => setExamDate(event.target.value)}
              aria-invalid={dateError ? true : undefined}
              aria-describedby={describedBy("examen", t("Tu l’entres une seule fois. Tu pourras la changer."), dateError)}
            />
          </Field>

          <Segmented<string>
            label={t("Temps par jour")}
            value={String(perDay)}
            options={STUDY_MINUTES.map((value) => ({ value: String(value), label: durationLabel(value) }))}
            onChange={(value) => setMinutes(Number(value))}
          />

          <div role="status" className="flex items-start gap-3 rounded-[14px] bg-pale px-3.5 py-3 text-pale2">
            <span className="mt-0.5 shrink-0">
              <CalendarIcon size={22} />
            </span>
            <div className="flex flex-col gap-0.5 text-sm leading-snug">
              {valid ? (
                <p>
                  <b>{sessionCountLabel(count, perDay, lang)}</b> {t("jusqu’au {date}", { date: shortDate(date, lang) })}
                </p>
              ) : (
                <p>
                  <b>{t("Choisis la date de ton examen.")}</b>
                </p>
              )}
              <p className="text-[13px]">{t("Se met à jour quand tu changes la date ou le temps par jour.")}</p>
            </div>
          </div>

          {error ? (
            <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="mt-auto pb-6 pt-2">
            <Button type="submit" disabled={!valid || !course || saving} aria-busy={saving}>
              {saving ? t("Enregistrement…") : previous ? t("Mettre à jour mon planning") : t("Créer mon planning")}
            </Button>
          </div>
        </form>
      )}
    </Screen>
  );
}

export default function ReglagesPage() {
  return (
    <Suspense fallback={<Screen />}>
      <Reglages />
    </Suspense>
  );
}
