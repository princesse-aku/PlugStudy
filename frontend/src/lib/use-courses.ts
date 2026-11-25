"use client";

import { useEffect, useState } from "react";
import { useRequireStudent } from "@/lib/auth-context";
import { backend } from "@/lib/backend";
import type { AppUser, Course } from "@/lib/types";

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

  useEffect(() => {
    if (!uid) return;
    return backend.onCoursesChange(uid, (courses) => setState({ uid, courses, loaded: true }));
  }, [uid]);

  // Un autre compte s'est connecté entre-temps : on n'affiche pas les cours du précédent.
  if (state.uid !== uid) return { courses: [], loaded: false };
  return { courses: includeFailed ? state.courses : state.courses.filter((course) => course.status !== "error"), loaded: state.loaded };
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
