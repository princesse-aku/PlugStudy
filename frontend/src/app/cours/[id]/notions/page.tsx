"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { DemoBanner } from "@/components/DemoBanner";
import { BackHeader, ImportanceBadge, Notice } from "@/components/Revision";
import { Screen } from "@/components/Screen";
import { useNotions } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { importanceOf, rankNotions, sessionNotions } from "@/lib/revision";
import { useCourseScreen } from "@/lib/use-courses";

const PREVIEW = 5;

/** Écran 18 · Notions classées par importance, chacune avec sa source. */
export default function NotionsPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const state = useCourseScreen(id);
  const { items, loaded } = useNotions(state.phase === "ready" ? state.user.uid : undefined, id);
  const [all, setAll] = useState(false);

  if (state.phase === "waiting") return <Screen />;
  if (state.phase === "missing") {
    return (
      <Screen>
        <BackHeader href="/cours" title={t("Cours introuvable")} />
        <Notice>{t("Ce cours n’existe pas ou a été supprimé.")}</Notice>
      </Screen>
    );
  }

  const ranked = rankNotions(items);
  const must = sessionNotions(items).filter((notion) => importanceOf(notion) === "indispensable");
  const shown = all ? ranked : ranked.slice(0, PREVIEW);

  return (
    <Screen>
      <DemoBanner />
      <BackHeader href={`/cours/${id}`} title={state.course.name} subtitle={t("Tout le cours · classées par importance")} />

      {loaded && ranked.length === 0 ? (
        <Notice>{t("Les notions de ce cours ne sont pas encore prêtes.")}</Notice>
      ) : (
        <>
          <div className="flex flex-1 flex-col gap-2.5 px-5 pt-1">
            <p className="rounded-[14px] bg-pale px-4 py-3.5 text-[15px] leading-snug text-pale2">
              <b>
                {ranked.length > 1 ? t("{n} notions", { n: ranked.length }) : t("{n} notion", { n: ranked.length })}
              </b>{" "}
              {t("dans ce cours, dont")}{" "}
              <b>
                {must.length > 1 ? t("{n} indispensables", { n: must.length }) : t("{n} indispensable", { n: must.length })}
              </b>
              .
            </p>
            <ul className="flex flex-col gap-2.5">
              {shown.map((notion) => (
                <li
                  key={notion.id}
                  className="flex min-h-16 items-center justify-between gap-2.5 rounded-[14px] border border-line bg-card px-3.5 py-3"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-base font-semibold leading-snug">{notion.title}</span>
                    <span className="text-[13px] text-muted">{notion.source}</span>
                  </div>
                  <ImportanceBadge level={importanceOf(notion)} />
                </li>
              ))}
            </ul>
            {ranked.length > PREVIEW ? (
              <button
                type="button"
                aria-expanded={all}
                onClick={() => setAll((value) => !value)}
                className="flex min-h-11 items-center justify-center text-[15px] font-semibold text-deep"
              >
                {all ? t("Voir moins") : t("Voir les {n} notions", { n: ranked.length })}
              </button>
            ) : null}
          </div>
          <div className="px-5 pb-6 pt-2">
            <Link
              href={`/cours/${id}/seance`}
              className="flex min-h-[52px] items-center justify-center rounded-[14px] bg-accent px-4 text-base font-semibold text-on-accent hover:bg-deep"
            >
              {must.length > 1
                ? t("Commencer par les {n} indispensables", { n: must.length })
                : must.length === 1
                  ? t("Commencer par l’indispensable")
                  : t("Commencer la séance")}
            </Link>
          </div>
        </>
      )}
    </Screen>
  );
}
