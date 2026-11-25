"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { ProgressBar } from "@/components/CourseCard";
import { DemoBanner } from "@/components/DemoBanner";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, MessageIcon, SendIcon } from "@/components/Icons";
import { ImportanceBadge, Notice } from "@/components/Revision";
import { Screen } from "@/components/Screen";
import { useAttempts, useMessages, useNotions, seedSampleContent } from "@/lib/data";
import { averageQuizScore, courseSubtitle, errorMessage, notionsToStrengthen, prepSteps, recentConversations, starterQuestions } from "@/lib/detail";
import { importanceOf, rankNotions } from "@/lib/revision";
import { features } from "@/lib/features";
import { sampleContentAvailable } from "@/lib/sample-content";
import { dayLabel, relativeTime, shortDateOf } from "@/lib/time";
import { useCourseScreen } from "@/lib/use-courses";

type Tab = "fiche" | "quiz" | "ia";
const TABS: { id: Tab; label: string }[] = [
  { id: "fiche", label: "Fiche" },
  { id: "quiz", label: "Quiz" },
  { id: "ia", label: "IA" },
].filter((item) => item.id !== "ia" || features.assistant) as { id: Tab; label: string }[];

const cta =
  "flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-accent px-4 text-base font-semibold text-on-accent hover:bg-deep";

function Detail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const param = useSearchParams().get("onglet");
  const tab: Tab = param === "quiz" ? "quiz" : param === "ia" && features.assistant ? "ia" : "fiche";
  const state = useCourseScreen(id);
  const uid = state.phase === "ready" ? state.user.uid : undefined;
  const { items: notions } = useNotions(uid, id);
  const { attempts: allAttempts } = useAttempts(uid);
  const { messages } = useMessages(uid, id);
  const [question, setQuestion] = useState("");
  const [seeding, setSeeding] = useState(false);

  if (state.phase === "waiting") return <Screen app />;
  if (state.phase === "missing") {
    return (
      <Screen>
        <header className="flex items-center gap-2 px-2 pb-2 pt-3">
          <Link href="/cours" aria-label="Retour" className="flex h-11 w-11 items-center justify-center">
            <ChevronLeftIcon />
          </Link>
          <h1 className="font-display text-lg font-bold">Cours introuvable</h1>
        </header>
        <Notice>Ce cours n’existe pas ou a été supprimé.</Notice>
      </Screen>
    );
  }

  const { user, course } = state;
  const preparing = course.status === "preparing";
  const failed = course.status === "error";
  const waiting = preparing || failed; // pas de fiche, de quiz ni d'IA tant que le cours n'est pas prêt
  const attempts = allAttempts.filter((attempt) => attempt.courseId === id);
  const ranked = rankNotions(notions);

  const go = (name: Tab) => `/cours/${id}${name === "fiche" ? "" : `?onglet=${name}`}`;

  function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (text) router.push(`/cours/${id}/assistant?q=${encodeURIComponent(text)}`);
  }

  return (
    <Screen app>
      <DemoBanner />
      <header className="flex items-center gap-2 px-2 pb-2 pt-3">
        <Link href="/cours" aria-label="Retour" className="flex h-11 w-11 shrink-0 items-center justify-center">
          <ChevronLeftIcon />
        </Link>
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate font-display text-lg font-bold">{course.name}</h1>
          <p className="text-[13px] text-muted">{courseSubtitle(course, relativeTime(course.createdAt))}</p>
        </div>
      </header>

      <div className="flex items-center gap-3 px-5 pb-2.5">
        <div className="flex-1">
          <ProgressBar value={course.progress} label={`Progression de ${course.name}`} />
        </div>
        <span className="text-sm font-bold text-pale2">{course.progress} %</span>
      </div>

      <nav aria-label="Sections du cours" className="mx-5 flex gap-1 rounded-[14px] bg-pale p-1">
        {TABS.map(({ id: name, label }) => {
          const on = name === (waiting ? "fiche" : tab);
          const locked = waiting && name !== "fiche";
          const base = "flex min-h-11 flex-1 items-center justify-center rounded-[10px] text-[15px]";
          const look = on ? "bg-card font-bold text-ink" : "font-medium text-muted";
          return locked ? (
            <span key={name} aria-disabled="true" className={`${base} ${look} opacity-70`}>
              {label}
            </span>
          ) : (
            <Link key={name} href={go(name)} aria-current={on ? "page" : undefined} className={`${base} ${look}`}>
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-3.5">
        {preparing ? (
          <div className="flex flex-col gap-3.5">
            <section aria-labelledby="prep" className="flex flex-col gap-3.5 rounded-2xl border border-line bg-card px-4 py-[18px]">
              <h2 id="prep" className="font-display text-xl font-bold">
                On prépare ton cours
              </h2>
              <p className="text-[15px] leading-relaxed text-muted">
                L’IA lit ton fichier, puis prépare ta fiche, ton quiz et ton plan de révision.
              </p>
              <ol className="flex flex-col gap-3">
                {prepSteps(course).map((step) => (
                  <li
                    key={step.label}
                    aria-current={step.state === "current" ? "step" : undefined}
                    className={`flex items-center gap-3 text-[15px] ${
                      step.state === "todo" ? "text-muted" : "text-ink"
                    } ${step.state === "current" ? "font-semibold" : ""}`}
                  >
                    {step.state === "done" ? (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
                        <CheckIcon size={16} />
                      </span>
                    ) : (
                      <span
                        aria-hidden="true"
                        className={`box-border h-6 w-6 shrink-0 rounded-full ${
                          step.state === "current" ? "border-[3px] border-spark" : "border-2 border-field"
                        }`}
                      />
                    )}
                    <span>
                      {step.label}
                      <span className="sr-only">
                        {step.state === "done" ? " : terminé" : step.state === "current" ? " : en cours" : " : à venir"}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
            <p className="rounded-[14px] bg-pale px-3.5 py-3 text-sm leading-relaxed text-pale2">
              Tu peux quitter cette page : le cours reste dans « Mes cours » et sera prêt dans un instant.
            </p>
            {sampleContentAvailable ? (
              <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-field bg-card px-4 py-4">
                <p className="text-[13px] leading-snug text-muted">
                  Développement uniquement : l’IA qui lit les fichiers n’existe pas encore. Ce bouton remplit le cours avec
                  des notions et des questions d’exemple (ce n’est pas le contenu de ton fichier) pour essayer l’application.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={seeding}
                  aria-busy={seeding}
                  onClick={async () => {
                    setSeeding(true);
                    try {
                      await seedSampleContent(user, course);
                    } finally {
                      setSeeding(false);
                    }
                  }}
                >
                  {seeding ? "Remplissage…" : "Remplir avec un contenu d’exemple"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {failed ? (
          <section role="alert" className="flex flex-col gap-2.5 rounded-2xl border-2 border-danger bg-danger-bg px-4 py-[18px]">
            <h2 className="font-display text-xl font-bold text-danger">{errorMessage(course.errorReason).title}</h2>
            <p className="text-[15px] leading-relaxed text-ink">{errorMessage(course.errorReason).text}</p>
          </section>
        ) : null}

        {!waiting && tab === "fiche" ? (
          <div className="flex flex-col gap-3">
            <section aria-labelledby="resume" className="flex flex-col gap-2 rounded-2xl border border-line bg-card px-4 py-3.5">
              <h2 id="resume" className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted">
                Résumé du cours
              </h2>
              <p className="text-[15px] leading-relaxed">{course.summary ?? "Le résumé de ce cours n’est pas encore disponible."}</p>
              {course.summary ? (
                <p className="text-xs leading-snug text-muted">Généré par l’IA à partir de ton fichier. Vérifie avec ton cours.</p>
              ) : null}
            </section>

            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Notions à retenir</h2>
              {ranked.length > 3 ? (
                <Link href={`/cours/${id}/notions`} className="flex min-h-11 items-center text-sm font-semibold text-deep">
                  Voir les {ranked.length}
                </Link>
              ) : null}
            </div>
            {ranked.length === 0 ? <Notice>Les notions de ce cours ne sont pas encore prêtes.</Notice> : null}
            <ul className="flex flex-col gap-2.5">
              {ranked.slice(0, 3).map((notion) => (
                <li
                  key={notion.id}
                  className="flex min-h-[60px] items-center justify-between gap-2.5 rounded-[14px] border border-line bg-card px-3.5 py-3"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-base font-semibold leading-snug">{notion.title}</span>
                    <span className="text-[13px] text-muted">{notion.source}</span>
                  </div>
                  <ImportanceBadge level={importanceOf(notion)} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!waiting && tab === "quiz" ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2.5">
              <div className="flex flex-1 flex-col gap-0.5 rounded-[14px] border border-line bg-card px-3.5 py-3">
                <span className="font-display text-2xl font-bold">{attempts.length}</span>
                <span className="text-[13px] text-muted">{attempts.length > 1 ? "Quiz faits" : "Quiz fait"}</span>
              </div>
              <div className="flex flex-1 flex-col gap-0.5 rounded-[14px] border border-line bg-card px-3.5 py-3">
                <span className="font-display text-2xl font-bold">
                  {averageQuizScore(attempts) === null ? "–" : `${averageQuizScore(attempts)} %`}
                </span>
                <span className="text-[13px] text-muted">Moyenne</span>
              </div>
            </div>

            <h2 className="font-display text-lg font-bold">Mes quiz</h2>
            {attempts.length === 0 ? (
              <Notice>Tu n’as pas encore fait de quiz. Lance le premier quand tu veux.</Notice>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {attempts.map((attempt) => (
                  <li key={attempt.id}>
                    <Link
                      href={`/cours/${id}/resultat?tentative=${attempt.id}`}
                      className="flex min-h-[60px] items-center justify-between gap-2.5 rounded-[14px] border border-line bg-card px-3.5 py-3"
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="text-base font-semibold">Quiz de fin de séance</span>
                        <span className="text-[13px] text-muted">Terminé le {shortDateOf(attempt.at)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[15px] font-bold text-pale2">
                        <CheckIcon size={16} />
                        {attempt.score}/{attempt.total}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {notionsToStrengthen(notions, attempts).length > 0 ? (
              <section aria-labelledby="renforcer" className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-card p-3.5">
                <h2 id="renforcer" className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted">
                  À renforcer
                </h2>
                {notionsToStrengthen(notions, attempts).map((notion) => (
                  <div key={notion.id} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[15px]">
                      <span className="font-semibold">{notion.title}</span>
                      <span className="font-bold text-pale2">{Math.round(notion.mastery * 100)} %</span>
                    </div>
                    <ProgressBar value={Math.round(notion.mastery * 100)} label={`Maîtrise de ${notion.title}`} />
                  </div>
                ))}
              </section>
            ) : null}
          </div>
        ) : null}

        {!waiting && tab === "ia" ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-2xl bg-pale px-4 py-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
                <MessageIcon />
              </span>
              <p className="text-[15px] leading-snug text-pale2">
                Pose-moi une question sur {course.name}. Je réponds uniquement avec ton cours.
              </p>
            </div>

            {starterQuestions(notions).length > 0 ? (
              <>
                <h2 className="font-display text-lg font-bold">Pour démarrer</h2>
                {starterQuestions(notions).map((text) => (
                  <Link
                    key={text}
                    href={`/cours/${id}/assistant?q=${encodeURIComponent(text)}`}
                    className="flex min-h-[52px] items-center justify-between gap-2 rounded-[14px] border-[1.5px] border-accent bg-card px-4 text-[15px] font-semibold text-pale2"
                  >
                    <span>{text}</span>
                    <ChevronRightIcon size={18} />
                  </Link>
                ))}
              </>
            ) : null}

            {recentConversations(messages).length > 0 ? (
              <>
                <h2 className="mt-1 font-display text-lg font-bold">Dernières conversations</h2>
                <ul className="flex flex-col">
                  {recentConversations(messages).map((conversation) => (
                    <li key={conversation.text} className="border-b border-line">
                      <Link
                        href={`/cours/${id}/assistant`}
                        className="flex min-h-[52px] items-center justify-between gap-2 px-1 text-[15px]"
                      >
                        <span>{conversation.text}</span>
                        <span className="shrink-0 text-[13px] text-muted">{dayLabel(conversation.at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {tab === "ia" && !waiting ? (
        <form onSubmit={ask} className="flex items-center gap-2.5 border-t border-line bg-card px-4 pb-4 pt-2.5">
          <input
            type="text"
            aria-label="Ta question"
            placeholder="Pose ta question sur ce cours"
            autoComplete="off"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className="h-12 min-w-0 flex-1 rounded-3xl border border-field bg-page px-[18px] text-[15px] text-ink placeholder:text-muted"
          />
          <button
            type="submit"
            aria-label="Ouvrir la conversation"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent"
          >
            <SendIcon />
          </button>
        </form>
      ) : (
        <div className="px-5 pb-6 pt-2.5">
          {failed ? (
            <Link href="/cours/ajouter" className={cta}>
              Choisir un autre fichier
            </Link>
          ) : preparing ? (
            <Button type="button" disabled aria-disabled="true">
              Réviser ce cours
            </Button>
          ) : tab === "quiz" ? (
            <Link href={`/cours/${id}/quiz`} className={cta}>
              Lancer un quiz
            </Link>
          ) : (
            <Link href={`/cours/${id}/seance`} className={cta}>
              Réviser ce cours
            </Link>
          )}
        </div>
      )}
    </Screen>
  );
}

/** Écrans 14 à 17 · Détail du cours : en préparation, puis onglets Fiche, Quiz et IA. */
export default function CoursDetailPage() {
  return (
    <Suspense fallback={<Screen app />}>
      <Detail />
    </Suspense>
  );
}
