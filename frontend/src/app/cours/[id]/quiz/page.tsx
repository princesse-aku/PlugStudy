"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { ProgressBar } from "@/components/CourseCard";
import { DemoBanner } from "@/components/DemoBanner";
import { CheckIcon, CrossIcon } from "@/components/Icons";
import { BackHeader, Notice, SourceChip } from "@/components/Revision";
import { Screen } from "@/components/Screen";
import { useI18n } from "@/lib/i18n";
import { loadQuestions, saveQuizAttempt, useNotions } from "@/lib/data";
import { pickQuizQuestions } from "@/lib/revision";
import { useCourseScreen } from "@/lib/use-courses";
import type { Question, QuizAnswer } from "@/lib/types";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** Écran 20 · Quiz de fin de séance : une question à la fois, avec « Pourquoi ce n'est pas A » et la source. */
export default function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const router = useRouter();
  const state = useCourseScreen(id);
  const uid = state.phase === "ready" ? state.user.uid : undefined;
  const { items: notions, loaded } = useNotions(uid, id);

  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  // Les questions sont choisies une seule fois : la maîtrise change à la fin du quiz, pas pendant.
  useEffect(() => {
    if (!uid || !loaded || started.current) return;
    started.current = true;
    loadQuestions(uid, id)
      .then((all) => setQuestions(pickQuizQuestions(all, notions)))
      .catch(() => setQuestions([]));
  }, [uid, loaded, id, notions]);

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
  const back = `/cours/${id}/seance`;

  if (questions === null) return <Screen />;
  if (questions.length === 0) {
    return (
      <Screen>
        <BackHeader href={back} title={t("Quiz de fin de séance")} />
        <Notice>{t("Le quiz de ce cours n’est pas encore prêt.")}</Notice>
      </Screen>
    );
  }

  const question = questions[index];
  const last = index === questions.length - 1;
  const answered = picked !== null;
  const wrong = answered && picked !== question.correctIndex;

  function choose(choice: number) {
    if (answered) return;
    setPicked(choice);
  }

  async function next() {
    if (picked === null) return;
    const answer: QuizAnswer = {
      questionId: question.id,
      notionId: question.notionId,
      notionTitle: notions.find((notion) => notion.id === question.notionId)?.title ?? "",
      source: question.source,
      correct: picked === question.correctIndex,
    };
    const all = [...answers, answer];
    if (!last) {
      setAnswers(all);
      setIndex(index + 1);
      setPicked(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const attemptId = await saveQuizAttempt(user, course, notions, all);
      router.push(`/cours/${id}/resultat?tentative=${attemptId}`);
    } catch {
      setError(t("Impossible d’enregistrer ton résultat. Vérifie ta connexion et réessaie."));
      setSaving(false);
    }
  }

  return (
    <Screen>
      <DemoBanner />
      <BackHeader href={back} title={t("Quiz de fin de séance")} subtitle={t("Question {n} sur {total}", { n: index + 1, total: questions.length })} />
      <div className="px-5 pb-2">
        <ProgressBar value={Math.round(((index + 1) / questions.length) * 100)} label={t("Avancement du quiz")} />
      </div>

      <div className="flex flex-1 flex-col gap-2.5 px-5 pt-2">
        <h2 className="mb-1 font-display text-xl font-bold leading-snug">{question.text}</h2>

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

        {answered ? (
          <section role="status" className="mt-1 flex flex-col gap-2 rounded-[14px] border border-line bg-card p-3.5">
            <h3 className="text-[15px] font-bold">
              {wrong ? t("Pourquoi ce n’est pas {lettre}", { lettre: LETTERS[picked ?? 0] }) : t("Pourquoi c’est juste")}
            </h3>
            <p className="text-sm leading-relaxed">{question.explanation}</p>
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
        <Button type="button" disabled={!answered || saving} aria-busy={saving} onClick={() => void next()}>
          {!answered ? t("Choisis une réponse") : saving ? t("Enregistrement…") : last ? t("Voir mon résultat") : t("Question suivante")}
        </Button>
      </div>
    </Screen>
  );
}
