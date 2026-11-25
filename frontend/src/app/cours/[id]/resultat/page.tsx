"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { DemoBanner } from "@/components/DemoBanner";
import { CheckIcon, CrossIcon } from "@/components/Icons";
import { BackHeader, Notice, Ring, SourceChip } from "@/components/Revision";
import { Screen } from "@/components/Screen";
import { useAttempts } from "@/lib/data";
import { features } from "@/lib/features";
import { resultTitle, scorePercent, wrongAnswers } from "@/lib/revision";
import { useCourseScreen } from "@/lib/use-courses";

const linkPrimary =
  "flex min-h-[52px] items-center justify-center rounded-[14px] bg-accent px-4 text-base font-semibold text-on-accent hover:bg-deep";
const linkSecondary =
  "flex min-h-[52px] items-center justify-center rounded-[14px] border-2 border-accent bg-card px-4 text-base font-semibold text-deep hover:bg-pale";

function Resultat() {
  const { id } = useParams<{ id: string }>();
  const tentative = useSearchParams().get("tentative");
  const state = useCourseScreen(id);
  const { attempts, loaded } = useAttempts(state.phase === "ready" ? state.user.uid : undefined);

  if (state.phase === "waiting" || !loaded) return <Screen />;
  const attempt = attempts.find((item) => item.id === tentative && item.courseId === id);

  if (!attempt || state.phase === "missing") {
    return (
      <Screen>
        <BackHeader href="/cours" title="Résultat du quiz" />
        <Notice>Ce résultat est introuvable.</Notice>
      </Screen>
    );
  }

  const percent = scorePercent(attempt.score, attempt.total);
  const wrong = wrongAnswers(attempt.answers);
  const first = wrong[0];

  return (
    <Screen>
      <DemoBanner />
      <BackHeader
        href={`/cours/${id}/quiz`}
        title="Résultat du quiz"
        subtitle={`${attempt.courseName} · Quiz de fin de séance`}
      />

      <div className="flex flex-1 flex-col gap-3 px-5 pt-2">
        <section className="flex items-center gap-4 rounded-[20px] border border-line bg-card p-4">
          <Ring value={percent} label={`Score : ${percent} %`} />
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-[28px] font-bold leading-tight">{resultTitle(percent)}</h2>
            <p className="text-base leading-snug">
              {attempt.score} {attempt.score > 1 ? "réponses justes" : "réponse juste"} sur {attempt.total}.
            </p>
          </div>
        </section>

        <h2 className="font-display text-lg font-bold">Tes réponses</h2>
        <ul className="flex flex-col gap-2">
          {attempt.answers.map((answer, index) => (
            <li
              key={answer.questionId}
              className="flex min-h-[52px] items-center gap-3 rounded-[14px] border border-line bg-card px-3.5 py-2.5"
            >
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${
                  answer.correct ? "bg-accent" : "bg-danger"
                }`}
              >
                {answer.correct ? <CheckIcon size={18} /> : <CrossIcon size={18} />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13px] text-muted">Question {index + 1}</span>
                <span className="text-[15px] font-semibold">{answer.notionTitle}</span>
              </span>
              <span className={`text-[13px] font-bold ${answer.correct ? "text-pale2" : "text-danger"}`}>
                {answer.correct ? "Juste" : "À revoir"}
              </span>
            </li>
          ))}
        </ul>

        {first ? (
          <section className="flex flex-col gap-1.5 rounded-[14px] bg-pale px-3.5 py-3 text-pale2">
            <p className="text-[15px] leading-snug">
              À revoir : <b>{first.notionTitle}</b>
              {wrong.length > 1 ? ` et ${wrong.length - 1} autre${wrong.length > 2 ? "s" : ""}` : ""}
            </p>
            <div>
              <SourceChip source={first.source} />
            </div>
          </section>
        ) : null}

        {features.suivi ? <p className="text-[13px] text-muted">Ce résultat met à jour ton Suivi.</p> : null}
      </div>

      <div className="flex flex-col gap-2 px-5 pb-6 pt-2.5">
        {first ? (
          <Link href={`/cours/${id}/seance?notion=${first.notionId}`} className={linkPrimary}>
            Revoir la notion
          </Link>
        ) : null}
        <Link href="/accueil" className={first ? linkSecondary : linkPrimary}>
          Terminer
        </Link>
      </div>
    </Screen>
  );
}

/** Écran 26 · Résultat du quiz : score, réponses justes et fausses, notion à revoir. */
export default function ResultatPage() {
  return (
    <Suspense fallback={<Screen />}>
      <Resultat />
    </Suspense>
  );
}
