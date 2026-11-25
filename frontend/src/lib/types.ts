export const NIVEAUX = [
  "Licence 1",
  "Licence 2",
  "Licence 3",
  "Master 1",
  "Master 2",
] as const;

export type Niveau = (typeof NIVEAUX)[number];
export type Langue = "fr" | "en";

/** Profil renseigné pendant l'onboarding (document Firestore users/{uid}). */
export interface Profile {
  niveau: Niveau;
  filiere: string;
  universite: string;
  langue: Langue;
}

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  /** false = compte e-mail dont l'adresse n'est pas encore confirmée (absent = confirmée). */
  emailVerified?: boolean;
}

export const CATEGORIES = ["Informatique", "Mathématiques", "Réseaux", "Comptabilité", "Droit", "Autre"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Formats de fichier acceptés pour un cours (écran 11). */
export const COURSE_EXTENSIONS = ["pdf", "docx", "ppt", "pptx", "txt"] as const;

/** Un cours de l'étudiant (document Firestore users/{uid}/courses/{id}). */
export interface Course {
  id: string;
  name: string;
  description: string;
  category: Category;
  fileName: string;
  fileSize: number;
  /** « preparing » tant que l'IA n'a pas produit la fiche, le quiz et le plan de révision. */
  status: "preparing" | "ready" | "error";
  /** 0 à 100. */
  progress: number;
  /** Date d'examen au format AAAA-MM-JJ, ou null. */
  examDate: string | null;
  createdAt: number;
  lastStudiedAt: number | null;
  /** Résumé du cours généré par l'IA (onglet Fiche). Écrit par le backend. */
  summary?: string;
  /** Étapes de préparation terminées (0 à 4) : lecture, fiche, quiz, plan de révision. Écrit par le backend. */
  prepStep?: number;
  /** Pourquoi la préparation a échoué (status « error ») : écrit par le backend. */
  /** L'étudiant a fermé l'avis d'échec : le cours ne lui est plus signalé. */
  dismissed?: boolean;
  errorReason?: "format" | "unreadable" | "empty" | "ai" | "failed" | "upload";
}

export type CourseInput = Pick<Course, "name" | "description" | "category" | "fileName" | "fileSize">;

/** Une notion extraite d'un cours (users/{uid}/courses/{id}/notions/{nid}). Écrite par le backend d'IA. */
export interface Notion {
  id: string;
  title: string;
  /** Passage du cours (« Ce que dit ton cours »). */
  excerpt: string;
  /** Explication simple (« En termes simples »). */
  simple: string;
  /** Source affichée, par exemple « Algorithmique, chap. 2, p. 14 ». */
  source: string;
  /** Importance jugée par l'IA (I), fréquence dans le cours (F), position (P) : chacune entre 0 et 1. */
  importance: number;
  frequency: number;
  position: number;
  /** Maîtrise (M) entre 0 et 1, 0 au départ ; mise à jour après chaque quiz. */
  mastery: number;
}

export interface Question {
  id: string;
  notionId: string;
  text: string;
  choices: string[];
  correctIndex: number;
  /** Explication « Pourquoi ce n'est pas A », avec le passage du cours. */
  explanation: string;
  source: string;
}

export interface QuizAnswer {
  questionId: string;
  notionId: string;
  notionTitle: string;
  source: string;
  correct: boolean;
}

export interface Attempt {
  id: string;
  courseId: string;
  courseName: string;
  at: number;
  score: number;
  total: number;
  answers: QuizAnswer[];
}

/** Temps de révision passé sur une notion (alimente l'activité du Suivi). */
export interface StudySession {
  id: string;
  courseId: string;
  notionId: string;
  minutes: number;
  at: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Source citée par une réponse de l'assistant. */
  source?: string;
  at: number;
}
