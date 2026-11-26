import { localeOf, translate, type Lang } from "@/lib/i18n/translate";
import { generalQuizQuestions, rankNotions } from "@/lib/revision";
import type { Course, Notion, Plan, PlanSession, Question } from "@/lib/types";

/**
 * Planning de révision (écrans 22, 23 et 29).
 *
 * Règle du document de fonctionnalités : une session par jour, d'aujourd'hui à la veille de l'examen ; les chapitres et
 * leurs quiz alternent, la dernière session est une révision générale. Exemple de la maquette : examen le 12 déc.,
 * départ le 7 déc. = 5 sessions (chapitre 1, quiz 1, chapitre 2, quiz 2, révision générale).
 * Les cas que la maquette ne montre pas (trop ou trop peu de jours) sont des hypothèses à calibrer, voir `sessionPlan`.
 */

export const STUDY_MINUTES = [30, 60, 120] as const;
export const DEFAULT_STUDY_MINUTES = 60;

// ---------- Dates (AAAA-MM-JJ, heure locale) ----------

const pad = (value: number) => String(value).padStart(2, "0");

export function toISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Midi local : à l'abri des changements d'heure. */
export function fromISO(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export const isISODate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) && toISO(fromISO(value)) === value;

export const todayISO = (now: Date = new Date()): string => toISO(now);

export function addDays(iso: string, days: number): string {
  const date = fromISO(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

/** Nombre de jours de `from` à `to` (négatif si `to` est avant). */
export function daysBetween(from: string, to: string): number {
  const a = fromISO(from);
  const b = fromISO(to);
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
}

/** Lundi de la semaine qui contient ce jour. */
export function mondayOf(iso: string): string {
  return addDays(iso, -((fromISO(iso).getDay() + 6) % 7));
}

export const firstOfMonth = (iso: string): string => `${iso.slice(0, 7)}-01`;

export function addMonths(iso: string, months: number): string {
  const date = fromISO(firstOfMonth(iso));
  date.setMonth(date.getMonth() + months);
  return toISO(date);
}

/** Les semaines (lundi à dimanche) qui couvrent le mois de `iso`, avec les jours voisins pour remplir les bords. */
export function monthGrid(iso: string): { iso: string; inMonth: boolean }[][] {
  const first = firstOfMonth(iso);
  const month = first.slice(0, 7);
  const lastDay = addDays(addMonths(first, 1), -1);
  const weeks: { iso: string; inMonth: boolean }[][] = [];
  for (let start = mondayOf(first); start <= lastDay; start = addDays(start, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, index) => {
        const day = addDays(start, index);
        return { iso: day, inMonth: day.slice(0, 7) === month };
      })
    );
  }
  return weeks;
}

export const weekDays = (iso: string): string[] => Array.from({ length: 7 }, (_, index) => addDays(mondayOf(iso), index));

// ---------- Textes datés ----------

const format = (iso: string, lang: Lang, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(localeOf(lang), options).format(fromISO(iso));
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** « 12 déc. » */
export const shortDate = (iso: string, lang: Lang): string => format(iso, lang, { day: "numeric", month: "short" });

/** « Décembre 2026 » */
export const monthTitle = (iso: string, lang: Lang): string => capitalize(format(iso, lang, { month: "long", year: "numeric" }));

/** « L », « M »… dans l'ordre lundi à dimanche. */
export const weekdayInitials = (lang: Lang): string[] =>
  weekDays("2026-11-30").map((day) => capitalize(format(day, lang, { weekday: "narrow" })));

/** « MER » : trois lettres, sans point, en majuscules. */
export const weekdayAbbr = (iso: string, lang: Lang): string =>
  format(iso, lang, { weekday: "short" }).replace(".", "").slice(0, 3).toUpperCase();

/** « mercredi 9 décembre » */
export const longDate = (iso: string, lang: Lang): string => format(iso, lang, { weekday: "long", day: "numeric", month: "long" });

/** « 7 – 13 déc. 2026 » */
export function weekTitle(monday: string, lang: Lang): string {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.slice(0, 7) === sunday.slice(0, 7);
  const first = sameMonth ? format(monday, lang, { day: "numeric" }) : shortDate(monday, lang);
  return `${first} – ${shortDate(sunday, lang)} ${sunday.slice(0, 4)}`;
}

/** 30 → « 30 min », 60 → « 1 h », 120 → « 2 h ». */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${pad(rest)}`;
}

/** « 5 sessions d'1 h » : l'élision n'existe que devant « 1 h » (« une heure »). */
export function sessionCountLabel(count: number, minutes: number, lang: Lang): string {
  const duree = durationLabel(minutes);
  const elided = minutes === 60;
  if (count === 1) {
    return elided ? translate("{n} session d’{duree}", lang, { n: count, duree }) : translate("{n} session de {duree}", lang, { n: count, duree });
  }
  return elided ? translate("{n} sessions d’{duree}", lang, { n: count, duree }) : translate("{n} sessions de {duree}", lang, { n: count, duree });
}

// ---------- Découpage du cours ----------

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };

function chapterNumber(raw: string): number {
  if (/^\d+$/.test(raw)) return Number(raw);
  const letters = raw.toUpperCase().split("");
  return letters.reduce((sum, letter, index) => {
    const value = ROMAN[letter] ?? 0;
    return sum + (value < (ROMAN[letters[index + 1]] ?? 0) ? -value : value);
  }, 0);
}

/** Numéro de chapitre lu dans la source d'une notion (« Algorithmique, chap. 2, p. 14 »), 0 s'il n'y en a pas. */
export function chapterOf(source: string): number {
  const match = /\b(?:chap|ch)\.\s*(\d+|[IVXLC]+)\b/i.exec(source);
  return match ? chapterNumber(match[1]) : 0;
}

export interface CourseUnits {
  unit: PlanSession["unit"];
  /** Numéros à afficher, dans l'ordre croissant. */
  numbers: number[];
}

/**
 * Les unités du cours : ses chapitres (lus dans la source des notions, « Algorithmique, chap. 2, p. 14 »), sinon des
 * parties de quatre notions.
 */
export function courseUnits(notions: Pick<Notion, "source">[]): CourseUnits {
  const chapters = new Set<number>();
  for (const notion of notions) {
    const number = chapterOf(notion.source);
    if (number > 0) chapters.add(number);
  }
  if (chapters.size > 0) return { unit: "chapter", numbers: [...chapters].sort((a, b) => a - b) };
  const parts = Math.max(1, Math.ceil(notions.length / 4));
  return { unit: "part", numbers: Array.from({ length: parts }, (_, index) => index + 1) };
}

type Draft = Pick<PlanSession, "kind" | "from" | "to">;

/** Le contenu des sessions d'un planning de `days` jours (le dernier jour est toujours la révision générale). */
function sessionPlan(numbers: number[], days: number): Draft[] {
  if (days <= 0) return [];
  const chapter = (from: number, to = from): Draft => ({ kind: "chapter", from, to });
  const quiz = (n: number): Draft => ({ kind: "quiz", from: n, to: n });
  const general: Draft = { kind: "general", from: 0, to: 0 };
  const slots = days - 1; // les jours avant la révision générale
  const count = numbers.length;

  if (slots >= count * 2) {
    // Assez de jours : chapitre puis quiz, et si des jours restent, des révisions de chapitre à tour de rôle.
    const drafts = numbers.flatMap((n) => [chapter(n), quiz(n)]);
    for (let extra = 0; drafts.length < slots; extra++) {
      drafts.push({ kind: "review", from: numbers[extra % count], to: numbers[extra % count] });
    }
    return [...drafts, general];
  }
  if (slots >= count) {
    // Tous les chapitres, avec un quiz après les premiers tant qu'il reste des jours.
    const quizzes = slots - count;
    return [...numbers.flatMap((n, index) => (index < quizzes ? [chapter(n), quiz(n)] : [chapter(n)])), general];
  }
  // Moins de jours que de chapitres : des chapitres regroupés, à parts presque égales.
  const drafts: Draft[] = [];
  let start = 0;
  for (let group = 0; group < slots; group++) {
    const size = Math.floor(count / slots) + (group < count % slots ? 1 : 0);
    drafts.push(chapter(numbers[start], numbers[start + size - 1]));
    start += size;
  }
  return [...drafts, general];
}

/** Une session par jour de `start` à la veille de `exam` ; vide si l'examen n'est pas après `start`. */
export function buildSessions(units: CourseUnits, minutes: number, start: string, exam: string): PlanSession[] {
  return sessionPlan(units.numbers, daysBetween(start, exam)).map((draft, index) => ({
    ...draft,
    unit: units.unit,
    date: addDays(start, index),
    minutes,
    done: false,
  }));
}

/** Nombre de sessions d'un planning (une par jour jusqu'à la veille de l'examen). */
export const sessionCount = (start: string, exam: string): number => Math.max(0, daysBetween(start, exam));

const sameContent = (a: PlanSession, b: PlanSession) => a.date === b.date && a.kind === b.kind && a.from === b.from && a.to === b.to;

/**
 * Plan complet d'un cours. Quand on change la date ou la durée, les jours déjà passés gardent leur historique et les
 * sessions déjà faites restent faites si elles retombent sur le même jour avec le même contenu.
 */
export function buildPlan(
  course: Pick<Course, "id" | "name">,
  notions: Pick<Notion, "source">[],
  settings: { examDate: string; minutes: number },
  today: string,
  previous?: Plan | null
): Plan {
  const fresh = buildSessions(courseUnits(notions), settings.minutes, today, settings.examDate);
  const old = previous?.sessions ?? [];
  const kept = old.filter((session) => session.date < today);
  const merged = fresh.map((session) => ({ ...session, done: old.some((before) => before.done && sameContent(before, session)) }));
  return {
    id: course.id,
    courseId: course.id,
    courseName: course.name,
    examDate: settings.examDate,
    minutes: settings.minutes,
    createdAt: previous?.createdAt ?? Date.now(),
    sessions: [...kept, ...merged],
  };
}

// ---------- Lecture du planning ----------

export function sessionTitle(session: Pick<PlanSession, "kind" | "unit" | "from" | "to">, lang: Lang): string {
  const chapter = session.unit === "chapter";
  const range = session.from !== session.to;
  switch (session.kind) {
    case "chapter":
      if (range) return translate(chapter ? "Chapitres {from} à {to}" : "Parties {from} à {to}", lang, { from: session.from, to: session.to });
      return translate(chapter ? "Chapitre {n}" : "Partie {n}", lang, { n: session.from });
    case "quiz":
      return translate("Quiz {n}", lang, { n: session.from });
    case "review":
      return translate(chapter ? "Révision chapitre {n}" : "Révision partie {n}", lang, { n: session.from });
    default:
      return translate("Révision générale", lang);
  }
}

export interface AgendaEntry {
  plan: Plan;
  session: PlanSession;
  /** Position de la session dans `plan.sessions` (pour la marquer comme faite). */
  index: number;
}

/** Toutes les sessions de tous les plans, dans l'ordre des jours. */
export function agenda(plans: Plan[]): AgendaEntry[] {
  return plans
    .flatMap((plan) => plan.sessions.map((session, index) => ({ plan, session, index })))
    .sort((a, b) => a.session.date.localeCompare(b.session.date) || a.plan.courseName.localeCompare(b.plan.courseName, "fr"));
}

export const entriesOn = (entries: AgendaEntry[], iso: string): AgendaEntry[] => entries.filter((entry) => entry.session.date === iso);

export const examsOn = (plans: Plan[], iso: string): Plan[] => plans.filter((plan) => plan.examDate === iso);

/** Point sous un jour du calendrier : « done » (tout fait), « planned » (il reste à faire) ou rien. */
export function dayMark(entries: AgendaEntry[], iso: string): "done" | "planned" | null {
  const day = entriesOn(entries, iso);
  if (day.length === 0) return null;
  return day.every((entry) => entry.session.done) ? "done" : "planned";
}

/** Les révisions à afficher : celles à faire (même en retard) et celles d'aujourd'hui ou à venir. */
export const upcoming = (entries: AgendaEntry[], today: string): AgendaEntry[] =>
  entries.filter((entry) => entry.session.date >= today || !entry.session.done);

/** « 2 sessions faites sur 5 » pour les jours donnés. */
export function weekProgress(entries: AgendaEntry[], days: string[]): { done: number; total: number } {
  const inWeek = entries.filter((entry) => days.includes(entry.session.date));
  return { done: inWeek.filter((entry) => entry.session.done).length, total: inWeek.length };
}

/** Le plan dont l'examen est le plus proche (ou le dernier passé) : celui que l'en-tête du Planning présente. */
export function focusPlan(plans: Plan[], today: string): Plan | null {
  const sorted = [...plans].sort((a, b) => a.examDate.localeCompare(b.examDate));
  return sorted.find((plan) => plan.examDate >= today) ?? sorted[sorted.length - 1] ?? null;
}

// ---------- Urgence de l'examen et quiz prévus ----------

/**
 * Urgence U de l'examen, pour la priorité R = U × Σ S(1 − M) des cours à reprendre : 1 sans date ou à plus de 14 jours,
 * puis elle monte jusqu'à 3 le jour de l'examen ; un examen passé compte moitié moins. Hypothèse de départ à calibrer.
 */
export function examUrgency(examDate: string | null | undefined, today: string): number {
  if (!examDate || !isISODate(examDate)) return 1;
  const days = daysBetween(today, examDate);
  if (days < 0) return 0.5;
  if (days >= 14) return 1;
  return 1 + (14 - days) / 7;
}

/** « jeudi 10 déc. » */
export const weekdayShortDate = (iso: string, lang: Lang): string => format(iso, lang, { weekday: "long", day: "numeric", month: "short" });

/** Les notions d'une unité du planning : un chapitre, ou une partie de quatre notions (dans l'ordre du classement). */
export function unitNotions(notions: Notion[], unit: PlanSession["unit"], n: number): Notion[] {
  return unit === "chapter" ? notions.filter((notion) => chapterOf(notion.source) === n) : rankNotions(notions).slice((n - 1) * 4, n * 4);
}

/** Questions du « quiz n » du planning : celles des notions du chapitre (ou de la partie) n. */
export const unitQuizQuestions = (questions: Question[], notions: Notion[], unit: PlanSession["unit"], n: number): Question[] =>
  generalQuizQuestions(questions, unitNotions(notions, unit, n));

export interface PlannedQuiz {
  session: PlanSession;
  /** Position dans `plan.sessions` (pour marquer la session comme faite). */
  index: number;
}

/**
 * La session du planning que ce quiz accomplit, s'il en reste une à faire : le « quiz n » d'un chapitre (ou d'une partie),
 * ou la révision générale pour le quiz général. -1 sinon.
 */
export function quizSessionIndex(plan: Plan | null | undefined, unit: { unit: PlanSession["unit"]; n: number } | null): number {
  return (plan?.sessions ?? []).findIndex((session) =>
    unit
      ? session.kind === "quiz" && session.unit === unit.unit && session.from === unit.n && !session.done
      : session.kind === "general" && !session.done
  );
}

/** Les quiz du planning qui restent à faire (quiz de chapitre et révision générale), dans l'ordre des jours. */
export function plannedQuizzes(plan: Plan | null | undefined): PlannedQuiz[] {
  return (plan?.sessions ?? [])
    .map((session, index) => ({ session, index }))
    .filter(({ session }) => (session.kind === "quiz" || session.kind === "general") && !session.done)
    .sort((a, b) => a.session.date.localeCompare(b.session.date));
}
