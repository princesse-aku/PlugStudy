"use client";

import { useEffect, useState } from "react";
import { backend } from "@/lib/backend";
import { applyQuiz } from "@/lib/revision";
import { SAMPLE_SUMMARY, buildSampleContent } from "@/lib/sample-content";
import type { AppUser, Attempt, Course, Message, Notion, Question, QuizAnswer, StudySession } from "@/lib/types";

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
  answers: QuizAnswer[]
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
  });
  const { notions: updated, progress } = applyQuiz(notions, answers);
  const base = ["users", user.uid, "courses", course.id];
  const touched = new Set(answers.map((answer) => answer.notionId));
  await Promise.all(
    updated
      .filter((notion) => touched.has(notion.id))
      .map((notion) => backend.setDocument([...base, "notions", notion.id], { mastery: notion.mastery }, true))
  );
  await backend.setDocument(base, { progress, lastStudiedAt: now }, true);
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
