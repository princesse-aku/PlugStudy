"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { ProgressBar } from "@/components/CourseCard";
import { DemoBanner } from "@/components/DemoBanner";
import { CheckIcon, CrossIcon, LockIcon } from "@/components/Icons";
import { BackHeader, Notice, SourceChip } from "@/components/Revision";
import { Screen } from "@/components/Screen";
import { gradeAnswer, rephraseQuestions } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { loadQuestions, markSessionDone, saveQuizAttempt, useNotions, usePlans } from "@/lib/data";
import { quizSessionIndex, unitQuizQuestions } from "@/lib/planning";
import { PASS_PERCENT, generalQuizQuestions, generalUnlocked, localGrade, nextNotionId, notionQuiz, pendingNotions } from "@/lib/revision";
import { useCourseScreen } from "@/lib/use-courses";
import type { Question, QuizAnswer } from "@/lib/types";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/**
 * Écran 20 · Quiz : une question à la fois, avec « Pourquoi ce n'est pas A » et la source.
 * Avec `?notion=`, c'est le quiz de cette notion seulement (celle qu'on vient de réviser) ; avec `?chapitre=n` (ou `?partie=n`),
 * le quiz du chapitre n prévu au planning ; sans rien, le quiz général de fin de cours.
 */
function Quiz() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const wanted = params.get("notion");
  const chapter = Number(params.get("chapitre")) || 0;
  const part = Number(params.get("partie")) || 0;
  const round = Number(params.get("essai")) || 0; // numéro de la tentative du quiz général (0 = la première)
  const unit = chapter > 0 ? { unit: "chapter" as const, n: chapter } : part > 0 ? { unit: "part" as const, n: part } : null;
  const state = useCourseScreen(id);
  const uid = state.phase === "ready" ? state.user.uid : undefined;
  const { items: notions, loaded } = useNotions(uid, id);
  const { plans } = usePlans(uid);

  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [grading, setGrading] = useState(false);
  const [verdict, setVerdict] = useState<{ correct: boolean; feedback: string } | null>(null);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  // Les questions sont choisies une seule fois : la maîtrise change à la fin du quiz, pas pendant.
  useEffect(() => {
    if (!uid || !loaded || started.current) return;
    started.current = true;
    const focusNotion = wanted ? notions.find((notion) => notion.id === wanted) : undefined;
    loadQuestions(uid, id)
      .then(async (all) => {
        if (wanted) return focusNotion ? notionQuiz(all, focusNotion, lang) : [];
        if (unit) return unitQuizQuestions(all, notions, unit.unit, unit.n);
        const general = generalQuizQuestions(all, notions, round, lang);
        if (round === 0) return general;
        // Nouvelle tentative : l'IA reformule les questions à choix (mêmes réponses) ; sans elle, on garde les originales.
        const texts = await rephraseQuestions(
          id,
          general.filter((question) => question.kind !== "written").map((question) => question.id)
        );
        return general.map((question) => (texts[question.id] ? { ...question, text: texts[question.id] } : question));
      })
      .then(setQuestions)
      .catch(() => setQuestions([]));
    // `unit` est relu à chaque rendu mais ne change pas pendant le quiz : seuls `chapter` et `part` comptent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, loaded, id, notions, wanted, chapter, part, round, lang]);

  if (state.phase === "waiting") return <Screen />;
  if (state.phase === "missing") {
    return (
      <Screen>
        <BackHeader href="/cours" title={t("Cours introuvable")} />
        <Notice>{t("Ce cours n’existe pas ou a été supprimé.")}</Notice>
      </Screen>
    );
  }

  const { user, course } = state;
  const focus = wanted ? notions.find((notion) => notion.id === wanted) : undefined;
  const back = focus ? `/cours/${id}/seance?notion=${focus.id}` : unit ? `/cours/${id}?onglet=quiz` : `/cours/${id}/seance`;
  const title = focus ? t("Quiz sur la notion") : unit ? t("Quiz {n}", { n: unit.n }) : t("Quiz général");

  if (!wanted && !unit && loaded && !generalUnlocked(notions)) {
    const pending = pendingNotions(notions);
    return (
      <Screen>
        <BackHeader href={`/cours/${id}?onglet=quiz`} title={t("Quiz général")} subtitle={t("Verrouillé")} />
        <div className="flex flex-1 flex-col gap-3 px-5 pt-2">
          <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-card p-4">
            <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-full bg-pale text-pale2">
              <LockIcon size={24} />
            </span>
            <h2 className="font-display text-xl font-bold leading-snug">{t("Valide d’abord les notions indispensables")}</h2>
            <p className="text-[15px] leading-snug text-muted">
              {t("Le quiz général s’ouvre quand chaque notion indispensable a obtenu au moins {percent} % à son quiz.", { percent: PASS_PERCENT })}
            </p>
          </section>
          <h3 className="font-display text-lg font-bold">{t("Il te reste à valider")}</h3>
          <ul className="flex flex-col gap-2">
            {pending.map((notion) => (
              <li key={notion.id}>
                <Link
                  href={`/cours/${id}/seance?notion=${notion.id}`}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-[14px] border border-line bg-card px-3.5 py-3 text-[15px] font-semibold hover:bg-pale"
                >
                  {notion.title}
                  <span className="shrink-0 text-[13px] font-bold text-deep">{t("Réviser")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Screen>
    );
  }
  if (questions === null) return <Screen />;
  if (questions.length === 0) {
    const next = focus ? nextNotionId(notions, focus.id) : null;
    return (
      <Screen>
        <BackHeader href={back} title={title} subtitle={focus?.title} />
        <Notice>{focus ? t("Cette notion n’a pas encore de questions.") : t("Le quiz de ce cours n’est pas encore prêt.")}</Notice>
        {focus ? (
          <div className="px-5 pb-6 pt-2">
            <Link
              href={next ? `/cours/${id}/seance?notion=${next}` : "/accueil"}
              className="flex min-h-[52px] items-center justify-center rounded-[14px] bg-accent px-4 text-base font-semibold text-on-accent hover:bg-deep"
            >
              {next ? t("Notion suivante") : t("Terminer")}
            </Link>
          </div>
        ) : null}
      </Screen>
    );
  }
  const position = t("Question {n} sur {total}", { n: index + 1, total: questions.length });

  const question = questions[index];
  const last = index === questions.length - 1;
  const written = question.kind === "written";
  const answered = written ? verdict !== null : picked !== null;
  const correct = written ? verdict?.correct === true : picked === question.correctIndex;
  const wrong = answered && !correct;

  function choose(choice: number) {
    if (answered) return;
    setPicked(choice);
  }

  // Réponse écrite : l'IA la compare au passage du cours ; si elle ne répond pas, une correction par mots-clés la remplace.
  async function submitWritten() {
    const notion = notions.find((item) => item.id === question.notionId);
    if (!notion || grading) return;
    setGrading(true);
    const graded = (await gradeAnswer(id, notion.id, text)) ?? localGrade(text, notion);
    setVerdict({ correct: graded.correct, feedback: graded.feedback || question.explanation });
    setGrading(false);
  }

  async function next() {
    if (!answered) return;
    const answer: QuizAnswer = {
      questionId: question.id,
      notionId: question.notionId,
      notionTitle: notions.find((notion) => notion.id === question.notionId)?.title ?? "",
      source: question.source,
      correct,
      ...(written ? { written: true } : {}),
      // Le conseil : pourquoi ça n'a pas marché, en bref (l'explication de la question, ou le retour de la correction).
      ...(correct ? {} : { advice: written ? (verdict?.feedback ?? question.explanation) : question.explanation }),
    };
    const all = [...answers, answer];
    if (!last) {
      setAnswers(all);
      setIndex(index + 1);
      setPicked(null);
      setText("");
      setVerdict(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const attemptId = await saveQuizAttempt(user, course, notions, all, focus ? "notion" : unit ? "unit" : "general");
      if (!focus) {
        // Le quiz du chapitre (ou le quiz général) accomplit la session prévue au planning : elle passe à « faite ».
        const plan = plans.find((item) => item.courseId === id);
        const planned = quizSessionIndex(plan, unit);
        if (plan && planned >= 0) await markSessionDone(user, plan, planned).catch(() => undefined);
      }
      router.push(`/cours/${id}/resultat?tentative=${attemptId}${focus ? `&notion=${focus.id}` : ""}`);
    } catch {
      setError(t("Impossible d’enregistrer ton résultat. Vérifie ta connexion et réessaie."));
      setSaving(false);
    }
  }

  return (
    <Screen>
      <DemoBanner />
      <BackHeader href={back} title={title} subtitle={focus ? `${focus.title} · ${position}` : position} />
      <div className="px-5 pb-2">
        <ProgressBar value={Math.round(((index + 1) / questions.length) * 100)} label={t("Avancement du quiz")} />
      </div>

      <div className="flex flex-1 flex-col gap-2.5 px-5 pt-2">
        <h2 className="mb-1 font-display text-xl font-bold leading-snug">{question.text}</h2>

        {written ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="reponse-ecrite" className="text-sm font-semibold">
              {t("Ta réponse")}
            </label>
            <textarea
              id="reponse-ecrite"
              rows={6}
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={answered || grading}
              placeholder={t("Écris ta réponse avec tes mots.")}
              className="w-full rounded-xl border border-field bg-card px-4 py-3 text-base leading-snug text-ink placeholder:text-muted"
            />
          </div>
        ) : (
        <ul className="flex flex-col gap-2.5">
          {question.choices.map((choice, choiceIndex) => {
            const isRight = answered && choiceIndex === question.correctIndex;
            const isWrong = answered && choiceIndex === picked && choiceIndex !== question.correctIndex;
            const style = isRight
              ? "border-2 border-accent bg-pale"
              : isWrong
                ? "border-2 border-danger bg-danger-bg"
                : "border border-line bg-card";
            const marker = isRight ? (
              <CheckIcon size={18} />
            ) : isWrong ? (
              <CrossIcon size={18} />
            ) : (
              LETTERS[choiceIndex]
            );
            return (
              <li key={choice}>
                <button
                  type="button"
                  onClick={() => choose(choiceIndex)}
                  disabled={answered}
                  aria-pressed={choiceIndex === picked}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-[14px] px-3.5 py-3 text-left ${style}`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                      isRight
                        ? "bg-accent text-on-accent"
                        : isWrong
                          ? "bg-danger text-white"
                          : "box-border border-2 border-field text-muted"
                    }`}
                  >
                    {marker}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[15px] leading-snug">{choice}</span>
                    {isWrong ? <span className="text-[13px] font-bold text-danger">{t("Ta réponse")}</span> : null}
                    {isRight ? <span className="text-[13px] font-bold text-pale2">{t("Bonne réponse")}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        )}

        {answered ? (
          <section role="status" className="mt-1 flex flex-col gap-2 rounded-[14px] border border-line bg-card p-3.5">
            <h3 className="text-[15px] font-bold">
              {written
                ? correct
                  ? t("Bien vu")
                  : t("Pas tout à fait")
                : wrong
                  ? t("Pourquoi ce n’est pas {lettre}", { lettre: LETTERS[picked ?? 0] })
                  : t("Pourquoi c’est juste")}
            </h3>
            <p className="text-sm leading-relaxed">{written ? verdict?.feedback : question.explanation}</p>
            {written && wrong ? (
              <p className="text-sm leading-relaxed text-muted">
                <b>{t("Dans ton cours :")}</b> {question.explanation}
              </p>
            ) : null}
            <div>
              <SourceChip source={question.source} />
            </div>
          </section>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>

      <div className="px-5 pb-6 pt-2">
        <Button
          type="button"
          disabled={answered ? saving : written ? grading || text.trim().length < 3 : true}
          aria-busy={saving || grading}
          onClick={() => void (answered ? next() : submitWritten())}
        >
          {answered
            ? saving
              ? t("Enregistrement…")
              : last
                ? t("Voir mon résultat")
                : t("Question suivante")
            : written
              ? grading
                ? t("Correction…")
                : t("Valider ma réponse")
              : t("Choisis une réponse")}
        </Button>
      </div>
    </Screen>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={<Screen />}>
      <Quiz />
    </Suspense>
  );
}
