"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ButtonLink } from "@/components/Button";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, CircleCheckIcon } from "@/components/Icons";
import { useAuth } from "@/lib/auth-context";
import { markSessionDone, usePlans } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import {
  addDays,
  addMonths,
  agenda,
  dayMark,
  durationLabel,
  entriesOn,
  examsOn,
  focusPlan,
  longDate,
  monthGrid,
  monthTitle,
  mondayOf,
  sessionTitle,
  shortDate,
  todayISO,
  upcoming,
  weekDays,
  weekProgress,
  weekTitle,
  weekdayAbbr,
  weekdayInitials,
  type AgendaEntry,
} from "@/lib/planning";
import { useFeatureGate } from "@/lib/use-feature-gate";
import type { Plan } from "@/lib/types";

type Tone = "today" | "plain" | "exam";

const DATE_TONE: Record<Tone, string> = {
  today: "bg-accent text-on-accent",
  plain: "bg-pale text-pale2",
  exam: "bg-spark text-black",
};

/** Petit carré de date : « MER » au-dessus du numéro du jour. */
function DateBlock({ iso, tone }: { iso: string; tone: Tone }) {
  const { lang } = useI18n();
  return (
    <div aria-hidden="true" className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ${DATE_TONE[tone]}`}>
      <span className="text-[10px] font-bold leading-none">{weekdayAbbr(iso, lang)}</span>
      <span className="font-display text-lg font-bold leading-tight">{Number(iso.slice(8))}</span>
    </div>
  );
}

const badge = "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold";

/** Carte d'une révision prévue (écran 23) : le jour, le cours, le contenu, la durée, « Marquer comme fait ». */
function SessionCard({
  entry,
  today,
  busy,
  onDone,
}: {
  entry: AgendaEntry;
  today: string;
  busy: boolean;
  onDone: (entry: AgendaEntry) => void;
}) {
  const { t, lang } = useI18n();
  const { plan, session } = entry;
  const isToday = session.date === today;
  const late = session.date < today && !session.done;
  const title = sessionTitle(session, lang);
  return (
    <li className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card p-3.5">
      <div className="flex items-center gap-3">
        <DateBlock iso={session.date} tone={isToday ? "today" : "plain"} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">{plan.courseName}</p>
          <p className="text-sm">{title}</p>
          <p className="text-[13px] text-muted">{durationLabel(session.minutes)}</p>
        </div>
        {isToday ? <span className={`${badge} bg-accent text-on-accent`}>{t("Aujourd’hui")}</span> : null}
        {late ? <span className={`${badge} bg-danger-bg text-danger`}>{t("En retard")}</span> : null}
      </div>
      <span className="sr-only">{longDate(session.date, lang)}</span>
      {session.done ? (
        <p className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-pale2">
          <CheckIcon size={18} />
          {t("Fait")}
        </p>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => onDone(entry)}
          aria-label={t("Marquer comme fait : {session}", { session: `${plan.courseName}, ${title}` })}
          className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold disabled:opacity-60 ${
            isToday ? "bg-accent text-on-accent hover:bg-deep" : "border-2 border-accent bg-card text-deep hover:bg-pale"
          }`}
        >
          <CheckIcon size={18} />
          {t("Marquer comme fait")}
        </button>
      )}
    </li>
  );
}

/** Flèches et titre d'une période (mois ou semaine). */
function PeriodNav({
  title,
  subtitle,
  previous,
  next,
  onPrevious,
  onNext,
}: {
  title: string;
  subtitle?: string;
  previous: string;
  next: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <button type="button" aria-label={previous} onClick={onPrevious} className="flex h-11 w-11 items-center justify-center">
        <ChevronLeftIcon />
      </button>
      <div className="text-center">
        <h2 className="font-display text-base font-bold">{title}</h2>
        {subtitle ? <p className="text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      <button type="button" aria-label={next} onClick={onNext} className="flex h-11 w-11 items-center justify-center">
        <ChevronRightIcon />
      </button>
    </div>
  );
}

/** Écran 23 · Planning, vue Mois : calendrier (faits, prévus, examen) puis les révisions prévues. */
function MonthView({
  plans,
  entries,
  today,
  cursor,
  setCursor,
  busyKey,
  onDone,
}: {
  plans: Plan[];
  entries: AgendaEntry[];
  today: string;
  cursor: string;
  setCursor: (iso: string) => void;
  busyKey: string | null;
  onDone: (entry: AgendaEntry) => void;
}) {
  const { t, lang } = useI18n();
  const weeks = monthGrid(cursor);
  const initials = weekdayInitials(lang);
  const list = upcoming(entries, today);
  return (
    <div className="flex flex-col gap-3 px-5 pt-3">
      <section className="rounded-2xl border border-line bg-card p-3">
        <PeriodNav
          title={monthTitle(cursor, lang)}
          previous={t("Mois précédent")}
          next={t("Mois suivant")}
          onPrevious={() => setCursor(addMonths(cursor, -1))}
          onNext={() => setCursor(addMonths(cursor, 1))}
        />
        <table className="mt-1 w-full border-separate border-spacing-y-1 text-center">
          <caption className="sr-only">{monthTitle(cursor, lang)}</caption>
          <thead>
            <tr>
              {initials.map((letter, index) => (
                <th key={index} scope="col" className="text-[11px] font-semibold text-muted">
                  {letter}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0].iso}>
                {week.map((day) => {
                  const mark = dayMark(entries, day.iso);
                  const exam = examsOn(plans, day.iso).length > 0;
                  const isToday = day.iso === today;
                  const look = isToday
                    ? "bg-accent font-bold text-on-accent"
                    : exam
                      ? "bg-spark font-bold text-black"
                      : day.inMonth
                        ? "text-ink"
                        : "text-muted opacity-60";
                  const status = exam ? t("Jour d’examen") : mark === "done" ? t("Fait") : mark === "planned" ? t("Prévu") : "";
                  return (
                    <td key={day.iso} className="h-11 align-top">
                      <span className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[13px] ${look}`}>
                        {Number(day.iso.slice(8))}
                        {status ? <span className="sr-only">{`, ${status}`}</span> : null}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`mx-auto mt-0.5 block h-1.5 w-1.5 rounded-full ${
                          mark === "done" ? "bg-accent" : mark === "planned" ? "border border-accent" : ""
                        }`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="flex items-center justify-center gap-4 pt-1 text-xs text-muted" aria-label={t("Légende")}>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
            {t("Fait")}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-2 rounded-full border border-accent" />
            {t("Prévu")}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-2 rounded-sm bg-spark" />
            {t("Jour d’examen")}
          </li>
        </ul>
      </section>

      <h2 className="font-display text-lg font-bold">{t("Révisions prévues")}</h2>
      {list.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card px-4 py-5 text-center text-[15px] leading-relaxed text-muted">
          {t("Rien de prévu pour l’instant.")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {list.map((entry) => (
            <SessionCard
              key={`${entry.plan.courseId}:${entry.index}`}
              entry={entry}
              today={today}
              busy={busyKey === `${entry.plan.courseId}:${entry.index}`}
              onDone={onDone}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Une ligne de la vue Semaine. */
function WeekRow({
  iso,
  today,
  title,
  detail,
  entry,
  exam,
  busy,
  onDone,
}: {
  iso: string;
  today: string;
  title: string;
  detail: string;
  entry?: AgendaEntry;
  exam?: boolean;
  busy?: boolean;
  onDone?: (entry: AgendaEntry) => void;
}) {
  const { t } = useI18n();
  const isToday = iso === today;
  const pending = entry && !entry.session.done;
  const highlighted = isToday && pending;
  return (
    <li
      className={`flex flex-col gap-2.5 rounded-2xl border p-3 ${
        highlighted ? "border-accent bg-accent text-on-accent" : "border-line bg-card"
      }`}
    >
      <div className="flex items-center gap-3">
        <DateBlock iso={iso} tone={exam ? "exam" : highlighted ? "plain" : isToday ? "today" : "plain"} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">{title}</p>
          <p className={`text-[13px] ${highlighted ? "text-on-accent" : "text-muted"}`}>{detail}</p>
        </div>
        {exam ? <span className={`${badge} bg-spark text-black`}>{t("Examen")}</span> : null}
        {highlighted ? <span className={`${badge} bg-card text-deep`}>{t("Aujourd’hui")}</span> : null}
        {entry?.session.done ? (
          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-pale2">
            <CheckIcon size={18} />
            {t("Fait")}
          </span>
        ) : null}
        {pending && !isToday && onDone ? (
          <button
            type="button"
            disabled={busy}
            aria-label={t("Marquer comme fait : {session}", { session: title })}
            onClick={() => onDone(entry)}
            className="flex h-11 w-11 shrink-0 items-center justify-center text-accent disabled:opacity-60"
          >
            <CircleCheckIcon size={28} />
          </button>
        ) : null}
        {!entry && !exam ? <span className="shrink-0 text-sm text-muted">{t("Repos")}</span> : null}
      </div>
      {highlighted && onDone && entry ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onDone(entry)}
          aria-label={t("Marquer comme fait : {session}", { session: title })}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-card text-[15px] font-semibold text-deep disabled:opacity-60"
        >
          <CheckIcon size={18} />
          {t("Marquer comme fait")}
        </button>
      ) : null}
    </li>
  );
}

/** Écran 29 · Planning, vue Semaine : une ligne par jour, du lundi au dimanche. */
function WeekView({
  plans,
  entries,
  today,
  cursor,
  setCursor,
  busyKey,
  onDone,
}: {
  plans: Plan[];
  entries: AgendaEntry[];
  today: string;
  cursor: string;
  setCursor: (iso: string) => void;
  busyKey: string | null;
  onDone: (entry: AgendaEntry) => void;
}) {
  const { t, lang } = useI18n();
  const days = weekDays(cursor);
  const progress = weekProgress(entries, days);
  const many = plans.length > 1;
  const summary =
    progress.total === 0
      ? t("Aucune session cette semaine")
      : progress.done === 1
        ? t("{done} session faite sur {total}", progress)
        : t("{done} sessions faites sur {total}", progress);
  return (
    <div className="flex flex-col gap-3 px-5 pt-3">
      <PeriodNav
        title={weekTitle(mondayOf(cursor), lang)}
        subtitle={summary}
        previous={t("Semaine précédente")}
        next={t("Semaine suivante")}
        onPrevious={() => setCursor(addDays(cursor, -7))}
        onNext={() => setCursor(addDays(cursor, 7))}
      />
      <ul className="flex flex-col gap-2.5">
        {days.flatMap((iso) => {
          const sessions = entriesOn(entries, iso);
          const exams = examsOn(plans, iso);
          const rows = [
            ...sessions.map((entry) => {
              const key = `${entry.plan.courseId}:${entry.index}`;
              const duration = durationLabel(entry.session.minutes);
              return (
                <WeekRow
                  key={key}
                  iso={iso}
                  today={today}
                  title={sessionTitle(entry.session, lang)}
                  detail={many ? `${entry.plan.courseName} · ${duration}` : duration}
                  entry={entry}
                  busy={busyKey === key}
                  onDone={onDone}
                />
              );
            }),
            ...exams.map((plan) => (
              <WeekRow key={`exam:${plan.courseId}`} iso={iso} today={today} title={plan.courseName} detail={t("Jour d’examen")} exam />
            )),
          ];
          if (rows.length > 0) return rows;
          return [<WeekRow key={`rest:${iso}`} iso={iso} today={today} title={t("Pas de session")} detail={shortDate(iso, lang)} />];
        })}
      </ul>
    </div>
  );
}

function Planning() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const enabled = useFeatureGate("planning", "/accueil");
  const view = useSearchParams().get("vue") === "semaine" ? "semaine" : "mois";
  const { plans, loaded } = usePlans(user?.uid);
  const today = todayISO();
  const [cursor, setCursor] = useState(today);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!enabled) return null;

  const entries = agenda(plans);
  const focus = focusPlan(plans, today);
  const subtitle = !focus
    ? null
    : plans.length > 1
      ? t("{n} cours · prochain examen le {date}", { n: plans.length, date: shortDate(focus.examDate, lang) })
      : t("{cours} · examen le {date} · {duree} par jour", {
          cours: focus.courseName,
          date: shortDate(focus.examDate, lang),
          duree: durationLabel(focus.minutes),
        });
  const modes = [
    { id: "mois", label: t("Mois"), href: "/planning" },
    { id: "semaine", label: t("Semaine"), href: "/planning?vue=semaine" },
  ];

  async function done(entry: AgendaEntry) {
    if (!user) return;
    setBusyKey(`${entry.plan.courseId}:${entry.index}`);
    setError(null);
    try {
      await markSessionDone(user, entry.plan, entry.index);
    } catch {
      setError(t("Impossible d’enregistrer. Vérifie ta connexion et réessaie."));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <>
      <header className="flex items-start justify-between gap-3 px-5 pb-2 pt-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="font-display text-[26px] font-bold leading-tight">{t("Planning")}</h1>
          {subtitle ? <p className="text-[13px] text-muted">{subtitle}</p> : null}
        </div>
        {focus ? (
          <Link href={`/planning/reglages?cours=${focus.courseId}`} className="flex min-h-11 shrink-0 items-center text-[15px] font-semibold text-deep">
            {t("Modifier")}
          </Link>
        ) : null}
      </header>

      {loaded && plans.length === 0 ? (
        <div className="flex flex-col gap-4 px-5 pt-3">
          <p className="rounded-2xl border border-line bg-card px-4 py-5 text-center text-[15px] leading-relaxed text-muted">
            {t("Tu n’as pas encore de planning. Donne la date de ton examen et le temps que tu peux réviser par jour : nous découpons ton cours en sessions.")}
          </p>
          <ButtonLink href="/planning/reglages">{t("Créer mon planning")}</ButtonLink>
        </div>
      ) : null}

      {plans.length > 0 ? (
        <>
          <div role="group" aria-label={t("Affichage du planning")} className="mx-5 mt-1 flex rounded-full bg-pale p-1">
            {modes.map((mode) => (
              <Link
                key={mode.id}
                href={mode.href}
                aria-current={view === mode.id ? "page" : undefined}
                className={`flex min-h-10 flex-1 items-center justify-center rounded-full text-sm ${
                  view === mode.id ? "bg-card font-bold text-ink shadow-sm" : "font-medium text-pale2"
                }`}
              >
                {mode.label}
              </Link>
            ))}
          </div>

          {error ? (
            <p role="alert" className="mx-5 mt-3 rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
              {error}
            </p>
          ) : null}

          {view === "mois" ? (
            <MonthView plans={plans} entries={entries} today={today} cursor={cursor} setCursor={setCursor} busyKey={busyKey} onDone={done} />
          ) : (
            <WeekView plans={plans} entries={entries} today={today} cursor={cursor} setCursor={setCursor} busyKey={busyKey} onDone={done} />
          )}
        </>
      ) : null}
    </>
  );
}

export default function PlanningPage() {
  return (
    <AppShell active="planning">
      <Suspense fallback={null}>
        <Planning />
      </Suspense>
    </AppShell>
  );
}
