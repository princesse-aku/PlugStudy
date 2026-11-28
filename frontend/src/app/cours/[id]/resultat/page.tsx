"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { DemoBanner } from "@/components/DemoBanner";
import { CheckIcon, CrossIcon } from "@/components/Icons";
import { BackHeader, Notice, Ring, SourceChip } from "@/components/Revision";
import { Screen } from "@/components/Screen";
import { useAttempts, useNotions } from "@/lib/data";
import { features } from "@/lib/features";
import { useI18n } from "@/lib/i18n";
import { PASS_PERCENT, generalUnlocked, isPassed, nextNotionId, resultTitle, scorePercent, wrongAnswers } from "@/lib/revision";
import { useCourseScreen } from "@/lib/use-courses";

const linkPrimary =
  "flex min-h-[52px] items-center justify-center rounded-[14px] bg-accent px-4 text-base font-semibold text-on-accent hover:bg-deep";
const linkSecondary =
  "flex min-h-[52px] items-center justify-center rounded-[14px] border-2 border-accent bg-card px-4 text-base font-semibold text-deep hover:bg-pale";

function Resultat() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useI18n();
  const params = useSearchParams();
  const tentative = params.get("tentative");
  const notionId = params.get("notion"); // présent quand on vient du quiz d'une notion
  const state = useCourseScreen(id);
  const uid = state.phase === "ready" ? state.user.uid : undefined;
  const { attempts, loaded } = useAttempts(uid);
  const { items: notions } = useNotions(uid, id);

  if (state.phase === "waiting" || !loaded) return <Screen />;
  const attempt = attempts.find((item) => item.id === tentative && item.courseId === id);

  if (!attempt || state.phase === "missing") {
    return (
      <Screen>
        <BackHeader href="/cours" title={t("Résultat du quiz")} />
        <Notice>{t("Ce résultat est introuvable.")}</Notice>
      </Screen>
    );
  }

  const percent = scorePercent(attempt.score, attempt.total);
  const wrong = wrongAnswers(attempt.answers);
  const first = wrong[0];
  const kind = attempt.kind ?? (notionId ? "notion" : "general");
  const passed = isPassed(attempt.score, attempt.total);
  const next = notionId ? nextNotionId(notions, notionId) : null;
  const generalRound = attempts.filter((item) => item.courseId === id && item.kind === "general").length; // tentatives déjà faites
  const review = first ? { href: `/cours/${id}/seance?notion=${first.notionId}`, label: t("Revoir la notion") } : null;
  // Après une notion : la suivante ; après la dernière, le quiz général (verrouillé tant que les indispensables ne sont pas validées).
  const onward = next
    ? { href: `/cours/${id}/seance?notion=${next}`, label: t("Notion suivante") }
    : notionId
      ? { href: `/cours/${id}/quiz`, label: generalUnlocked(notions) ? t("Passer au quiz général") : t("Notions à valider") }
      : null;

  // Les boutons, dans l'ordre ; le premier est mis en avant.
  // Notion validée : on avance. Sous 75 % : on est renvoyé à la notion (et on peut quand même avancer tant que la validation n'est pas stricte).
  const actions: { href: string; label: string }[] = [];
  if (kind === "notion") {
    if (passed) {
      if (onward) actions.push(onward);
      if (review) actions.push(review);
    } else {
      if (review) actions.push(review);
      if (onward && !features.strictValidation) actions.push(onward);
    }
  } else if (kind === "general") {
    if (review) actions.push(review);
    if (!passed) actions.push({ href: `/cours/${id}/quiz?essai=${generalRound}`, label: t("Refaire le quiz général") });
  } else if (review) {
    actions.push(review);
  }
  actions.push({ href: "/accueil", label: t("Terminer") });

  const verdict =
    kind === "notion"
      ? passed
        ? { ok: true, title: t("Notion validée"), text: t("Tu as obtenu au moins {percent} %. Tu peux passer à la suite.", { percent: PASS_PERCENT }) }
        : {
            ok: false,
            title: t("Notion pas encore validée"),
            text: t("Il faut au moins {percent} % pour valider une notion. Relis-la, puis réessaie.", { percent: PASS_PERCENT }),
          }
      : kind === "general"
        ? passed
          ? { ok: true, title: t("Cours validé"), text: t("Bravo : tu maîtrises ce cours.") }
          : {
              ok: false,
              title: t("Cours pas encore validé"),
              text: t("Il faut au moins {percent} % pour valider le cours. Revois les notions ratées, puis refais le quiz.", { percent: PASS_PERCENT }),
            }
        : null;
  const advice = wrong.filter((answer) => answer.advice).slice(0, 3);

  return (
    <Screen>
      <DemoBanner />
      <BackHeader
        href={notionId ? `/cours/${id}/quiz?notion=${notionId}` : `/cours/${id}/quiz`}
        title={t("Résultat du quiz")}
        subtitle={`${attempt.courseName} · ${notionId && attempt.answers[0] ? attempt.answers[0].notionTitle : t("Quiz général")}`}
      />

      <div className="flex flex-1 flex-col gap-3 px-5 pt-2">
        <section className="flex items-center gap-4 rounded-[20px] border border-line bg-card p-4">
          <Ring value={percent} label={t("Score : {percent} %", { percent })} />
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-[28px] font-bold leading-tight">{resultTitle(percent, lang)}</h2>
            <p className="text-base leading-snug">
              {attempt.score > 1
                ? t("{score} réponses justes sur {total}.", { score: attempt.score, total: attempt.total })
                : t("{score} réponse juste sur {total}.", { score: attempt.score, total: attempt.total })}
            </p>
          </div>
        </section>

        {verdict ? (
          <section
            role="status"
            className={`flex flex-col gap-0.5 rounded-[14px] px-3.5 py-3 ${verdict.ok ? "bg-pale text-pale2" : "bg-danger-bg text-danger"}`}
          >
            <h3 className="text-[15px] font-bold">{verdict.title}</h3>
            <p className="text-sm leading-snug">{verdict.text}</p>
          </section>
        ) : null}

        <h2 className="font-display text-lg font-bold">{t("Tes réponses")}</h2>
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
                <span className="text-[13px] text-muted">{t("Question {n}", { n: index + 1 })}</span>
                <span className="text-[15px] font-semibold">{answer.notionTitle}</span>
              </span>
              <span className={`text-[13px] font-bold ${answer.correct ? "text-pale2" : "text-danger"}`}>
                {answer.correct ? t("Juste") : t("À revoir")}
              </span>
            </li>
          ))}
        </ul>

        {advice.length > 0 ? (
          <section className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-card p-3.5">
            <h3 className="font-display text-lg font-bold">{t("Un conseil")}</h3>
            <ul className="flex flex-col gap-3">
              {advice.map((answer) => (
                <li key={answer.questionId} className="flex flex-col gap-1">
                  <p className="text-[15px] font-semibold">{answer.notionTitle}</p>
                  <p className="text-sm leading-relaxed">{answer.advice}</p>
                  <div>
                    <SourceChip source={answer.source} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : first ? (
          <section className="flex flex-col gap-1.5 rounded-[14px] bg-pale px-3.5 py-3 text-pale2">
            <p className="text-[15px] leading-snug">
              {t("À revoir :")} <b>{first.notionTitle}</b>
              {wrong.length > 2
                ? ` ${t("et {n} autres", { n: wrong.length - 1 })}`
                : wrong.length === 2
                  ? ` ${t("et 1 autre")}`
                  : ""}
            </p>
            <div>
              <SourceChip source={first.source} />
            </div>
          </section>
        ) : null}

        {features.suivi ? <p className="text-[13px] text-muted">{t("Ce résultat met à jour ton Suivi.")}</p> : null}
      </div>

      <div className="flex flex-col gap-2 px-5 pb-6 pt-2.5">
        {actions.map((action, index) => (
          <Link key={action.label} href={action.href} className={index === 0 ? linkPrimary : linkSecondary}>
            {action.label}
          </Link>
        ))}
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
