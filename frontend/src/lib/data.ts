"use client";

import { useEffect, useState } from "react";
import { backend } from "@/lib/backend";
import { applyQuiz, coursePriority, isPassed } from "@/lib/revision";
import { SAMPLE_SUMMARY, buildSampleContent } from "@/lib/sample-content";
import { buildPlan, examUrgency, todayISO } from "@/lib/planning";
import type { AppUser, Attempt, Course, Message, Notion, Plan, Question, QuizAnswer, StudySession } from "@/lib/types";

/** Écoute une collection sous users/{uid}. `loaded` reste false jusqu'à la première réponse. */
function useCollection<T>(path: string[] | null): { items: T[]; loaded: boolean } {
  const key = path ? path.join("/") : null;
  const [state, setState] = useState<{ key: string | null; items: T[]; loaded: boolean }>({
    key,
    items: [],
    loaded: false,
  });

  useEffect(() => {
    if (!key) return;
    return backend.watchCollection(key.split("/"), (docs) => setState({ key, items: docs as unknown as T[], loaded: true }));
  }, [key]);

  if (state.key !== key) return { items: [], loaded: false };
  return { items: state.items, loaded: state.loaded };
}

const sortByTime = <T extends { at: number }>(items: T[]) => [...items].sort((a, b) => a.at - b.at);

export function useNotions(uid: string | undefined, courseId: string) {
  return useCollection<Notion>(uid ? ["users", uid, "courses", courseId, "notions"] : null);
}

export function useAttempts(uid: string | undefined) {
  const { items, loaded } = useCollection<Attempt>(uid ? ["users", uid, "attempts"] : null);
  return { attempts: [...items].sort((a, b) => b.at - a.at), loaded };
}

export function useSessions(uid: string | undefined) {
  const { items, loaded } = useCollection<StudySession>(uid ? ["users", uid, "sessions"] : null);
  return { sessions: items, loaded };
}

export function usePlans(uid: string | undefined) {
  const { items, loaded } = useCollection<Plan>(uid ? ["users", uid, "plans"] : null);
  return { plans: items, loaded };
}

/**
 * Priorité R = U × Σ S(1 − M) de chaque cours prêt (U : urgence de l'examen, S : score des notions, M : maîtrise), pour
 * classer les cours à reprendre. Suit les notions de chaque cours en direct ; vide tant qu'elles ne sont pas chargées.
 */
export function useCoursePriorities(uid: string | undefined, courses: Course[]): Record<string, number> {
  const ready = courses.filter((course) => course.status === "ready");
  const key = uid ? `${uid}|${ready.map((course) => course.id).join(",")}` : "";
  const [state, setState] = useState<{ key: string; notions: Record<string, Notion[]> }>({ key, notions: {} });

  useEffect(() => {
    if (!key || !uid) return;
    const stops = key
      .split("|")[1]
      .split(",")
      .filter(Boolean)
      .map((courseId) =>
        backend.watchCollection(["users", uid, "courses", courseId, "notions"], (docs) =>
          setState((current) => ({ key, notions: { ...(current.key === key ? current.notions : {}), [courseId]: docs as unknown as Notion[] } }))
        )
      );
    return () => stops.forEach((stop) => stop());
  }, [key, uid]);

  if (state.key !== key) return {};
  const today = todayISO();
  return Object.fromEntries(
    ready.filter((course) => state.notions[course.id]).map((course) => [course.id, coursePriority(state.notions[course.id], examUrgency(course.examDate, today))])
  );
}

export function useMessages(uid: string | undefined, courseId: string) {
  const { items, loaded } = useCollection<Message>(uid ? ["users", uid, "courses", courseId, "messages"] : null);
  return { messages: sortByTime(items), loaded };
}

export async function loadQuestions(uid: string, courseId: string): Promise<Question[]> {
  const docs = await backend.listDocuments(["users", uid, "courses", courseId, "questions"]);
  return docs as unknown as Question[];
}

/** Retire l'`id`, qui est la clé du document et non un champ. */
function withoutId<T extends { id: string }>(item: T): Omit<T, "id"> {
  const { id, ...rest } = item;
  void id;
  return rest;
}

/**
 * Écrit des notions et des questions d'exemple et passe le cours à « prêt ».
 * Réservé au développement (voir sample-content.ts) : le vrai contenu viendra du backend d'IA.
 */
export async function seedSampleContent(user: AppUser, course: Course): Promise<void> {
  const { notions, questions } = buildSampleContent(course.name);
  const base = ["users", user.uid, "courses", course.id];
  await Promise.all([
    ...notions.map((notion) => backend.setDocument([...base, "notions", notion.id], withoutId(notion))),
    ...questions.map((question) => backend.setDocument([...base, "questions", question.id], withoutId(question))),
  ]);
  await backend.setDocument(base, { status: "ready", progress: 0, summary: SAMPLE_SUMMARY, prepStep: 4 }, true);
}

/** Enregistre un quiz : la tentative, la maîtrise des notions interrogées, puis la progression du cours. */
export async function saveQuizAttempt(
  user: AppUser,
  course: Course,
  notions: Notion[],
  answers: QuizAnswer[],
  kind: "notion" | "general" | "unit" = "unit"
): Promise<string> {
  const score = answers.filter((answer) => answer.correct).length;
  const now = Date.now();
  const id = await backend.addDocument(["users", user.uid, "attempts"], {
    courseId: course.id,
    courseName: course.name,
    at: now,
    score,
    total: answers.length,
    answers,
    kind,
  });
  const { notions: updated, progress } = applyQuiz(notions, answers);
  const base = ["users", user.uid, "courses", course.id];
  const touched = new Set(answers.map((answer) => answer.notionId));
  // Au moins 75 % au quiz d'une notion la valide ; au quiz général, c'est le cours qui est validé.
  const passed = isPassed(score, answers.length);
  await Promise.all(
    updated
      .filter((notion) => touched.has(notion.id))
      .map((notion) =>
        backend.setDocument(
          [...base, "notions", notion.id],
          kind === "notion" && passed ? { mastery: notion.mastery, validated: true } : { mastery: notion.mastery },
          true
        )
      )
  );
  await backend.setDocument(base, kind === "general" && passed ? { progress, lastStudiedAt: now, validated: true } : { progress, lastStudiedAt: now }, true);
  return id;
}

/** Enregistre le temps passé sur une notion (au moins une minute). */
export async function saveStudyTime(user: AppUser, course: Course, notionId: string, seconds: number): Promise<void> {
  const minutes = Math.max(1, Math.round(seconds / 60));
  const now = Date.now();
  await backend.addDocument(["users", user.uid, "sessions"], { courseId: course.id, notionId, minutes, at: now });
  await backend.setDocument(["users", user.uid, "courses", course.id], { lastStudiedAt: now }, true);
}

export async function saveMessage(user: AppUser, courseId: string, message: Omit<Message, "id">): Promise<void> {
  await backend.addDocument(["users", user.uid, "courses", courseId, "messages"], message);
}

/** Signalement d'une erreur de l'IA (sur une notion ou une réponse) : gardé pour que l'équipe le relise. */
export async function saveReport(user: AppUser, report: { courseId: string; notionId?: string; messageId?: string }): Promise<void> {
  const data: Record<string, unknown> = { courseId: report.courseId, at: Date.now() };
  if (report.notionId) data.notionId = report.notionId;
  if (report.messageId) data.messageId = report.messageId;
  await backend.addDocument(["users", user.uid, "reports"], data);
}

/**
 * Enregistre le planning d'un cours : la date d'examen et le temps par jour sur le cours, puis le découpage en sessions
 * (un document users/{uid}/plans/{courseId}, remplacé en entier). Les jours passés et les sessions déjà faites sont gardés.
 */
export async function savePlan(
  user: AppUser,
  course: Course,
  settings: { examDate: string; minutes: number },
  previous?: Plan | null
): Promise<Plan> {
  const notions = (await backend.listDocuments(["users", user.uid, "courses", course.id, "notions"])) as unknown as Notion[];
  const plan = buildPlan(course, notions, settings, todayISO(), previous);
  const { id, ...fields } = plan;
  void id;
  await backend.setDocument(["users", user.uid, "plans", course.id], fields);
  await backend.setDocument(["users", user.uid, "courses", course.id], { examDate: settings.examDate, studyMinutes: settings.minutes }, true);
  return plan;
}

/** Marque une session du planning comme faite : elle compte dans le temps de révision du Suivi. */
export async function markSessionDone(user: AppUser, plan: Plan, index: number): Promise<void> {
  const session = plan.sessions[index];
  if (!session || session.done) return;
  const sessions = plan.sessions.map((item, position) => (position === index ? { ...item, done: true } : item));
  const { id, ...fields } = { ...plan, sessions };
  void id;
  await backend.setDocument(["users", user.uid, "plans", plan.courseId], fields);
  const now = Date.now();
  await backend.addDocument(["users", user.uid, "sessions"], { courseId: plan.courseId, notionId: "", minutes: session.minutes, at: now });
  await backend.setDocument(["users", user.uid, "courses", plan.courseId], { lastStudiedAt: now }, true);
}
