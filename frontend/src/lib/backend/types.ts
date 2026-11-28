import type { AppUser, Course, CourseInput, Profile } from "@/lib/types";

export type DocData = Record<string, unknown> & { id: string };

/** Ce que l'application attend de la couche données (Firebase ou mode démo). */
export interface Backend {
  /** true quand les données sont simulées dans le navigateur. */
  demo: boolean;
  onAuthChange(callback: (user: AppUser | null) => void): () => void;
  signInWithEmail(email: string, password: string): Promise<AppUser>;
  signInWithGoogle(): Promise<AppUser>;
  /** Crée le compte, enregistre le nom et envoie le lien de vérification. */
  signUpWithEmail(name: string, email: string, password: string): Promise<AppUser>;
  sendVerificationEmail(): Promise<void>;
  /** Relit le compte (l'étudiant a peut-être ouvert le lien) et renvoie son état à jour. */
  refreshUser(): Promise<AppUser | null>;
  /** Supprime le compte non confirmé (changement d'adresse) ou, à défaut, déconnecte. */
  discardAccount(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
  /** Jeton Firebase de l'étudiant, envoyé au backend FastAPI (null en mode démo ou sans session). */
  getIdToken(): Promise<string | null>;
  getProfile(uid: string): Promise<Profile | null>;
  saveProfile(user: AppUser, profile: Profile): Promise<void>;
  /** Suit la liste des cours de l'étudiant (la plus récente d'abord) ; renvoie la fonction d'arrêt. */
  onCoursesChange(uid: string, callback: (courses: Course[]) => void): () => void;
  createCourse(user: AppUser, input: CourseInput): Promise<string>;
  /** Suit une collection (chemin sous users/{uid}) ; chaque document porte son `id`. */
  watchCollection(path: string[], callback: (docs: DocData[]) => void): () => void;
  listDocuments(path: string[]): Promise<DocData[]>;
  addDocument(path: string[], data: Record<string, unknown>): Promise<string>;
  /** Écrit le document dont le chemin est donné ; `merge` conserve les autres champs. */
  setDocument(path: string[], data: Record<string, unknown>, merge?: boolean): Promise<void>;
  /** Change le nom affiché du compte. */
  updateDisplayName(user: AppUser, name: string): Promise<void>;
  /** Supprime définitivement le compte et toutes ses données, puis déconnecte. */
  deleteAccount(user: AppUser): Promise<void>;
}

/** Erreur dont le message est déjà prêt à être montré à l'étudiant. */
export class UserFacingError extends Error {}
