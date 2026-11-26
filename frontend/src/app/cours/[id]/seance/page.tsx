"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { DemoBanner } from "@/components/DemoBanner";
import { MessageIcon, FlagIcon } from "@/components/Icons";
import { ProgressBar } from "@/components/CourseCard";
import { BackHeader, ImportanceBadge, Notice, SourceChip } from "@/components/Revision";
import { Screen } from "@/components/Screen";
import { saveReport, saveStudyTime, useNotions } from "@/lib/data";
import { features } from "@/lib/features";
import { useI18n } from "@/lib/i18n";
import { importanceOf, sessionNotions } from "@/lib/revision";
import { useCourseScreen } from "@/lib/use-courses";

function Seance() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const router = useRouter();
  const wanted = useSearchParams().get("notion");
  const state = useCourseScreen(id);
  const { items, loaded } = useNotions(state.phase === "ready" ? state.user.uid : undefined, id);
  const startedAt = useRef(Date.now());
  const [chosen, setChosen] = useState<number | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());

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
  const notions = sessionNotions(items);
  const wantedIndex = notions.findIndex((notion) => notion.id === wanted);
  const index = Math.min(chosen ?? (wantedIndex >= 0 ? wantedIndex : 0), Math.max(0, notions.length - 1));
  const notion = notions[index];

  /** Garde le temps passé sur la notion courante, puis exécute la suite. */
  async function leave(next: () => void) {
    if (notion) {
      const seconds = (Date.now() - startedAt.current) / 1000;
      startedAt.current = Date.now();
      try {
        await saveStudyTime(user, course, notion.id, seconds);
      } catch {
        // Le temps de révision est un plus : on ne bloque pas l'étudiant.
      }
    }
    next();
  }

  if (loaded && !notion) {
    return (
      <Screen>
        <BackHeader href={`/cours/${id}`} title={course.name} />
        <Notice>{t("Les notions de ce cours ne sont pas encore prêtes.")}</Notice>
      </Screen>
    );
  }
  if (!notion) return <Screen />;

  const isReported = reported.has(notion.id);

  return (
    <Screen>
      <DemoBanner />
      <BackHeader href={`/cours/${id}`} title={course.name} subtitle={t("Notion {n} sur {total}", { n: index + 1, total: notions.length })} />
      <div className="px-5 pb-2">
        <ProgressBar value={Math.round(((index + 1) / notions.length) * 100)} label={t("Avancement de la séance")} />
      </div>

      <div className="flex flex-1 flex-col gap-3.5 px-5 pt-2">
        <div className="flex flex-col items-start gap-2.5">
          <h2 className="font-display text-2xl font-bold leading-tight">{notion.title}</h2>
          <ImportanceBadge level={importanceOf(notion)} />
        </div>

        <section aria-labelledby="cours" className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card p-4">
          <h3 id="cours" className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted">
            {t("Ce que dit ton cours")}
          </h3>
          <p className="text-base leading-relaxed">{notion.excerpt}</p>
          <div>
            <SourceChip source={notion.source} />
          </div>
        </section>

        <section aria-labelledby="simple" className="flex flex-col gap-2 rounded-2xl bg-pale p-4">
          <h3 id="simple" className="text-[13px] font-bold uppercase tracking-[0.08em] text-pale2">
            {t("En termes simples")}
          </h3>
          <p className="text-base leading-relaxed text-pale2">{notion.simple}</p>
        </section>

        <div className="flex items-center justify-between gap-2">
          {features.assistant ? (
            <Link
              href={`/cours/${id}/assistant?notion=${notion.id}`}
              className="flex min-h-11 items-center gap-2 text-[15px] font-semibold text-deep"
            >
              <MessageIcon size={20} />
              {t("Poser une question")}
            </Link>
          ) : (
            <span />
          )}
          <button
            type="button"
            disabled={isReported}
            onClick={async () => {
              setReported((current) => new Set(current).add(notion.id));
              try {
                await saveReport(user, { courseId: id, notionId: notion.id });
              } catch {
                setReported((current) => {
                  const next = new Set(current);
                  next.delete(notion.id);
                  return next;
                });
              }
            }}
            className="flex min-h-11 items-center gap-2 text-[15px] font-semibold text-muted disabled:opacity-70"
          >
            <FlagIcon size={20} />
            {isReported ? t("Signalé, merci") : t("Signaler une erreur")}
          </button>
        </div>
        {isReported ? (
          <p role="status" className="text-[13px] text-muted">
            {t("Merci : nous relirons cette notion.")}
          </p>
        ) : null}

        {notions.length > 1 ? (
          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => void leave(() => setChosen(index - 1))}
              className="flex min-h-11 items-center text-sm font-semibold text-deep disabled:opacity-40"
            >
              {t("← Précédente")}
            </button>
            <button
              type="button"
              disabled={index >= notions.length - 1}
              onClick={() => void leave(() => setChosen(index + 1))}
              className="flex min-h-11 items-center text-sm font-semibold text-deep disabled:opacity-40"
            >
              {t("Notion suivante →")}
            </button>
          </div>
        ) : null}
      </div>

      <div className="px-5 pb-6 pt-2">
        <Button type="button" onClick={() => void leave(() => router.push(`/cours/${id}/quiz?notion=${notion.id}`))}>
          {t("Passer au quiz")}
        </Button>
      </div>
    </Screen>
  );
}

/** Écran 19 · Séance de révision : une notion à la fois, l'extrait du cours, sa source, une explication simple. */
export default function SeancePage() {
  return (
    <Suspense fallback={<Screen />}>
      <Seance />
    </Suspense>
  );
}
