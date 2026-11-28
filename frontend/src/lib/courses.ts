import type { Course } from "@/lib/types";

export type CourseFilter = "tous" | "en-cours" | "termines";

export const isDone = (course: Course) => course.progress >= 100;

export function countCourses(courses: Course[]) {
  const done = courses.filter(isDone).length;
  return { all: courses.length, done, inProgress: courses.length - done };
}

export function filterCourses(courses: Course[], filter: CourseFilter): Course[] {
  if (filter === "termines") return courses.filter(isDone);
  if (filter === "en-cours") return courses.filter((course) => !isDone(course));
  return courses;
}

/** Progression globale : moyenne de la progression des cours (0 sans cours). */
export function averageProgress(courses: Course[]): number {
  if (courses.length === 0) return 0;
  return Math.round(courses.reduce((total, course) => total + course.progress, 0) / courses.length);
}

/**
 * Cours à reprendre : prêts et pas terminés. Le premier est celui de plus forte priorité R = U × Σ S(1 − M) (voir
 * `useCoursePriorities`) ; à priorité égale (ou inconnue), le plus récemment révisé d'abord, puis les jamais révisés.
 */
export function coursesToResume(courses: Course[], priorities: Record<string, number> = {}): Course[] {
  return courses
    .filter((course) => course.status === "ready" && !isDone(course))
    .sort(
      (a, b) =>
        (priorities[b.id] ?? 0) - (priorities[a.id] ?? 0) ||
        (b.lastStudiedAt ?? 0) - (a.lastStudiedAt ?? 0) ||
        b.createdAt - a.createdAt
    );
}

/** Nom proposé d'après le fichier : « structures_de_donnees.pdf » devient « Structures de donnees ». */
export function nameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "";
}

export function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp", "tif", "tiff"];

export type ImportProblem = "unreadable" | "emptyfile";

/**
 * Problème visible avant même d'envoyer le fichier : une image (photo ou scan : l'IA ne lit que du texte), ou un fichier vide. Aucune limite de taille côté application.
 * Un PDF scanné, lui, ne se voit qu'à la lecture : c'est le backend qui le signale (« unreadable »).
 */
export function importProblem(file: Pick<File, "name" | "size">): ImportProblem | null {
  if (IMAGE_EXTENSIONS.includes(extensionOf(file.name))) return "unreadable";
  if (file.size === 0) return "emptyfile";
  return null;
}
