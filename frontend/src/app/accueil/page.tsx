"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ProgressBar } from "@/components/CourseCard";
import { BookIcon, CheckIcon, ChevronRightIcon, FileIcon, UploadIcon } from "@/components/Icons";
import { InstallBanner } from "@/components/InstallBanner";
import { useAuth } from "@/lib/auth-context";
import { averageProgress, coursesToResume } from "@/lib/courses";
import { useI18n } from "@/lib/i18n";
import { firstName } from "@/lib/names";
import { relativeTime } from "@/lib/time";
import { useAttempts, useSessions } from "@/lib/data";
import { useCourses } from "@/lib/use-courses";

function Stat({ value, label, muted, progress }: { value: string; label: string; muted?: boolean; progress?: number }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[92px] flex-col gap-1 rounded-2xl border border-line bg-card px-3 py-3.5">
      <div className={`font-display text-2xl font-bold leading-tight ${muted ? "text-muted" : ""}`}>{value}</div>
      <div className="text-[13px] text-muted">{label}</div>
      {progress !== undefined ? (
        <div className="mt-1">
          <ProgressBar value={progress} label={t("Progression globale")} />
        </div>
      ) : null}
    </div>
  );
}

/** Écrans 9 · Accueil et 27 · Accueil vide (aucun cours). */
export default function AccueilPage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const { courses, loaded } = useCourses(user?.uid);
  const empty = loaded && courses.length === 0;
  const resume = coursesToResume(courses).slice(0, 2);
  const progress = averageProgress(courses);
  const { attempts } = useAttempts(user?.uid);
  const { sessions } = useSessions(user?.uid);

  // Activité récente : cours ajoutés, séances et quiz, du plus récent au plus ancien.
  const activity = [
    ...courses.map((course) => ({
      key: "c" + course.id,
      at: course.createdAt,
      title: course.name,
      detail: t("Nouveau cours ajouté"),
      Icon: FileIcon,
    })),
    ...attempts.map((attempt) => ({
      key: "a" + attempt.id,
      at: attempt.at,
      title: attempt.courseName,
      detail: t("Quiz terminé : {score}/{total}", { score: attempt.score, total: attempt.total }),
      Icon: CheckIcon,
    })),
    ...sessions.map((session) => ({
      key: "s" + session.id,
      at: session.at,
      title: courses.find((course) => course.id === session.courseId)?.name ?? t("Cours"),
      detail: t("Séance de révision"),
      Icon: BookIcon,
    })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 3);

  return (
    <AppShell active="accueil" fab={loaded && !empty ? "round" : undefined}>
      <header className="flex flex-col gap-0.5 px-5 pb-2 pt-6">
        <h1 className="font-display text-[26px] font-bold leading-tight">{t("Bonjour, {name}", { name: firstName(user) })}</h1>
        <p className="text-[15px] text-muted">{empty ? t("Commençons par ton premier cours.") : t("Voici où tu en es.")}</p>
      </header>

      <div className="flex flex-col gap-3 px-5 pt-2">
        <div className="grid grid-cols-3 gap-2.5">
          <Stat value={String(courses.length)} label={t("Cours")} muted={empty} />
          <Stat value={String(attempts.length)} label={t("Quiz faits")} muted={empty} />
          <Stat
            value={`${progress} %`}
            label={t("Progression")}
            muted={empty}
            progress={empty || !loaded ? undefined : progress}
          />
        </div>

        <InstallBanner />

        {empty ? (
          <>
            <section
              aria-label={t("Premier cours")}
              className="flex flex-col items-center gap-3.5 rounded-[20px] border border-line bg-card px-5 py-6 text-center"
            >
              <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-pale text-pale2">
                <UploadIcon size={34} />
              </span>
              <h2 className="font-display text-[22px] font-bold leading-tight">{t("Ajoute ton premier cours")}</h2>
              <p className="text-[15px] leading-relaxed text-muted">
                {t("Dépose un fichier : PlugStudy prépare ta fiche, ton quiz et ton plan de révision.")}
              </p>
              <Link
                href="/cours/ajouter"
                className="flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-accent px-4 text-base font-semibold text-on-accent hover:bg-deep"
              >
                {t("Ajouter un cours")}
              </Link>
            </section>
            <p className="rounded-[14px] bg-pale px-3.5 py-3 text-sm leading-relaxed text-pale2">
              {t("Nous n’avons pas encore de cours types pour ta filière : ton premier fichier suffit pour commencer.")}
            </p>
          </>
        ) : null}

        {loaded && !empty ? (
          <>
            {resume.length > 0 ? (
              <section aria-labelledby="reprendre" className="flex flex-col gap-3">
                <div className="mt-1 flex items-baseline justify-between">
                  <h2 id="reprendre" className="font-display text-lg font-bold">
                    {t("À reprendre")}
                  </h2>
                  <Link href="/cours" className="flex min-h-11 items-center text-sm font-semibold text-deep">
                    {t("Voir tout")}
                  </Link>
                </div>
                {resume.map((course, index) => (
                  <Link
                    key={course.id}
                    href={`/cours/${course.id}/seance`}
                    className="flex min-h-[84px] items-center gap-3 rounded-2xl border border-line bg-card p-3.5 text-ink"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pale text-pale2">
                      <BookIcon />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      {index === 0 ? (
                        <span className="text-xs font-bold uppercase tracking-[0.08em] text-pale2">{t("Commence par ça")}</span>
                      ) : null}
                      <span className="font-display text-[17px] font-bold">{course.name}</span>
                      <span className="text-[13px] text-muted">
                        {course.lastStudiedAt
                          ? t("Révisé {when}", { when: relativeTime(course.lastStudiedAt, Date.now(), lang) })
                          : t("Pas encore révisé")}
                      </span>
                      <ProgressBar value={course.progress} label={t("Progression de {name}", { name: course.name })} />
                    </span>
                    <ChevronRightIcon size={20} />
                  </Link>
                ))}
              </section>
            ) : null}

            <section aria-labelledby="activite" className="flex flex-col gap-1">
              <h2 id="activite" className="mb-2 mt-1 font-display text-lg font-bold">
                {t("Activité récente")}
              </h2>
              <ul className="flex flex-col gap-1">
                {activity.map((item) => (
                  <li key={item.key} className="flex min-h-14 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pale text-pale2">
                      <item.Icon size={20} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-[15px] font-semibold">{item.title}</span>
                      <span className="text-[13px] text-muted">{item.detail}</span>
                    </span>
                    <span className="ml-auto whitespace-nowrap text-xs text-muted">{relativeTime(item.at, Date.now(), lang)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
