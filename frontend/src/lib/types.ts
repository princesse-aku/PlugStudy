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
  /** Temps de révision par jour choisi dans le Planning (30, 60 ou 120 minutes). */
  studyMinutes?: number;
  createdAt: number;
  lastStudiedAt: number | null;
  /** Résumé du cours généré par l'IA (onglet Fiche). Écrit par le backend. */
  summary?: string;
  /** Étapes de préparation terminées (0 à 4) : lecture, fiche, quiz, plan de révision. Écrit par le backend. */
  prepStep?: number;
  /** Pourquoi la préparation a échoué (status « error ») : écrit par le backend. */
  /** L'étudiant a fermé l'avis d'échec : le cours ne lui est plus signalé. */
  dismissed?: boolean;
  /** Cours validé : au moins 75 % au quiz général. */
  validated?: boolean;
  errorReason?: "format" | "unreadable" | "empty" | "ai" | "failed" | "upload" | "stalled";
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
  /** Validée : au moins 75 % au quiz de cette notion. */
  validated?: boolean;
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
  /** « written » : l'étudiant écrit sa réponse avec ses mots (corrigée par l'IA) ; par défaut, un choix parmi plusieurs. */
  kind?: "choice" | "written";
}

export interface QuizAnswer {
  questionId: string;
  notionId: string;
  notionTitle: string;
  source: string;
  correct: boolean;
  /** Réponse écrite à la main (et non un choix). */
  written?: boolean;
  /** Conseil montré après un quiz raté : pourquoi ça n'a pas marché, en bref. */
  advice?: string;
}

export interface Attempt {
  id: string;
  courseId: string;
  courseName: string;
  at: number;
  score: number;
  total: number;
  answers: QuizAnswer[];
  /** Quiz d'une notion, quiz général de fin de cours, ou quiz d'un chapitre prévu au planning. */
  kind?: "notion" | "general" | "unit";
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

/** Une session de révision du planning : un jour, un contenu (chapitre, quiz, révision), une durée. */
export interface PlanSession {
  /** AAAA-MM-JJ. */
  date: string;
  kind: "chapter" | "quiz" | "review" | "general";
  /** « chapter » : les chapitres du cours ; « part » : des parties de quatre notions quand le cours n'a pas de chapitres. */
  unit: "chapter" | "part";
  /** Numéros de l'unité concernée (de `from` à `to` ; 0 pour la révision générale). */
  from: number;
  to: number;
  minutes: number;
  done: boolean;
}

/** Planning d'un cours (users/{uid}/plans/{courseId}) : le découpage du cours en sessions jusqu'à l'examen. */
export interface Plan {
  id: string;
  courseId: string;
  courseName: string;
  /** AAAA-MM-JJ. */
  examDate: string;
  minutes: number;
  createdAt: number;
  sessions: PlanSession[];
}
