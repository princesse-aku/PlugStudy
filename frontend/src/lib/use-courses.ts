"use client";

import { useEffect, useState } from "react";
import { useRequireStudent } from "@/lib/auth-context";
import { backend } from "@/lib/backend";
import type { AppUser, Course } from "@/lib/types";

/** Une préparation dure une à deux minutes ; au-delà, le serveur s'est arrêté en route et le cours ne sera jamais prêt. */
export const STALLED_AFTER_MS = 10 * 60 * 1000;

/** Un cours resté « en préparation » trop longtemps est montré comme échoué (avec « Réessayer »), pas bloqué à 0 %. */
export function markStalled(courses: Course[], now: number): Course[] {
  return courses.map((course) =>
    course.status === "preparing" && now - course.createdAt > STALLED_AFTER_MS
      ? { ...course, status: "error", errorReason: "stalled" }
      : course,
  );
}

/**
 * Les cours de l'étudiant, mis à jour en direct. `loaded` reste false jusqu'à la première réponse.
 * Les cours dont la préparation a échoué ne sont pas listés (accueil, Mes cours) ; seul l'écran du cours les montre.
 */
export function useCourses(uid: string | undefined, includeFailed = false): { courses: Course[]; loaded: boolean } {
  const [state, setState] = useState<{ uid: string | undefined; courses: Course[]; loaded: boolean }>({
    uid,
    courses: [],
    loaded: false,
  });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!uid) return;
    return backend.onCoursesChange(uid, (courses) => {
      setNow(Date.now());
      setState({ uid, courses, loaded: true });
    });
  }, [uid]);

  // Re-vérifie chaque minute : un cours peut devenir « bloqué » sans qu'aucune donnée ne change.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Un autre compte s'est connecté entre-temps : on n'affiche pas les cours du précédent.
  if (state.uid !== uid) return { courses: [], loaded: false };
  const all = markStalled(state.courses, now);
  return { courses: includeFailed ? all : all.filter((course) => course.status !== "error"), loaded: state.loaded };
}

export type CourseScreenState =
  | { phase: "waiting" }
  | { phase: "missing"; user: AppUser }
  | { phase: "ready"; user: AppUser; course: Course };

/** Garde + chargement d'un cours pour les écrans de révision (renvoie vers la connexion si besoin). */
export function useCourseScreen(courseId: string): CourseScreenState {
  const { ok, user } = useRequireStudent();
  const { courses, loaded } = useCourses(user?.uid, true);
  if (!ok || !user || !loaded) return { phase: "waiting" };
  const course = courses.find((item) => item.id === courseId);
  return course ? { phase: "ready", user, course } : { phase: "missing", user };
}
