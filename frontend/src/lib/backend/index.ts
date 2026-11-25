import { demoBackend } from "./demo";
import { firebaseBackend, isFirebaseConfigured } from "./firebase";
import type { Backend } from "./types";

/**
 * Firebase dès que les variables NEXT_PUBLIC_FIREBASE_* sont renseignées.
 * Sinon, en développement seulement, un mode démo permet de parcourir les écrans.
 */
export const backend: Backend =
  !isFirebaseConfigured && process.env.NODE_ENV !== "production" ? demoBackend : firebaseBackend;

export { UserFacingError } from "./types";
export type { Backend } from "./types";
