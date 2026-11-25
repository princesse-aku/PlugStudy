"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CourseCard } from "@/components/CourseCard";
import { CheckIcon } from "@/components/Icons";
import { useAuth } from "@/lib/auth-context";
import { backend } from "@/lib/backend";
import { errorMessage } from "@/lib/detail";
import { countCourses, filterCourses, type CourseFilter } from "@/lib/courses";
import { useI18n } from "@/lib/i18n";
import { useCourses } from "@/lib/use-courses";

function MesCours() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { courses: everything, loaded } = useCourses(user?.uid, true);
  const courses = everything.filter((course) => course.status !== "error");
  const failed = everything.filter((course) => course.status === "error" && !course.dismissed);
  const added = useSearchParams().get("ajoute") === "1";
  const [filter, setFilter] = useState<CourseFilter>("tous");

  const counts = countCourses(courses);
  const visible = filterCourses(courses, filter);
  const tabs: { id: CourseFilter; label: string; count: number }[] = [
    { id: "tous", label: t("Tous"), count: counts.all },
    { id: "en-cours", label: t("En cours"), count: counts.inProgress },
    { id: "termines", label: t("Terminés"), count: counts.done },
  ];

  return (
    <>
      <header className="flex flex-col gap-0.5 px-5 pb-2 pt-6">
        <h1 className="font-display text-[26px] font-bold leading-tight">{t("Mes cours")}</h1>
        <p className="text-[15px] text-muted">
          {counts.done > 1
            ? t("{n} cours · {done} terminés", { n: counts.all, done: counts.done })
            : t("{n} cours · {done} terminé", { n: counts.all, done: counts.done })}
        </p>
      </header>

      <div role="group" aria-label={t("Filtrer les cours")} className="flex gap-2 px-5 py-1">
        {tabs.map((tab) => {
          const on = tab.id === filter;
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(tab.id)}
              className={`min-h-11 rounded-full px-4 text-sm ${
                on ? "border-2 border-accent bg-pale font-bold text-pale2" : "border border-field bg-card font-medium text-ink"
              }`}
            >
              {tab.label} {tab.count}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2.5 px-5 pt-2">
        {failed.map((course) => (
          <div key={course.id} role="alert" className="flex flex-col gap-2 rounded-[14px] border border-danger bg-card px-3.5 py-3 text-sm leading-snug">
            <p className="font-bold text-danger">
              {t("« {name} » n’a pas pu être préparé.", { name: course.name })}
            </p>
            <p className="text-ink">{t(errorMessage(course.errorReason).text)}</p>
            <div className="flex gap-2">
              <Link href="/cours/ajouter" className="flex min-h-11 items-center rounded-full bg-accent px-4 font-bold text-on-accent">
                {t("Réessayer")}
              </Link>
              <button
                type="button"
                className="min-h-11 rounded-full border border-field px-4 font-medium text-ink"
                onClick={() => {
                  if (user) void backend.setDocument(["users", user.uid, "courses", course.id], { dismissed: true }, true);
                }}
              >
                {t("Fermer")}
              </button>
            </div>
          </div>
        ))}

        {added && failed.length === 0 ? (
          <p
            role="status"
            className="flex items-start gap-2.5 rounded-[14px] bg-pale px-3.5 py-3 text-sm leading-snug text-pale2"
          >
            <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
              <CheckIcon size={16} />
            </span>
            <span>
              <b>{t("Cours ajouté.")}</b> {t("L’IA prépare la fiche, le quiz et le plan de révision.")}
            </span>
          </p>
        ) : null}

        {visible.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}

        {loaded && visible.length === 0 ? (
          <p className="rounded-2xl border border-line bg-card px-4 py-5 text-center text-[15px] leading-relaxed text-muted">
            {counts.all === 0
              ? t("Tu n’as pas encore de cours. Ajoute ton premier fichier pour commencer.")
              : t("Aucun cours dans cette liste.")}
          </p>
        ) : null}
      </div>
    </>
  );
}

/** Écrans 10 · Mes cours et 13 · Mes cours, après ajout (?ajoute=1). */
export default function CoursPage() {
  return (
    <AppShell active="cours" fab="pill">
      <Suspense fallback={null}>
        <MesCours />
      </Suspense>
    </AppShell>
  );
}
