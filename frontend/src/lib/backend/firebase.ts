import { FirebaseError, getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithPopup,
  updateProfile,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { CATEGORIES, type AppUser, type Category, type Course, type Langue, type Niveau, type Profile } from "@/lib/types";
import { UserFacingError, type Backend, type DocData } from "./types";

// Next.js remplace ces variables au moment du build : il faut les écrire en toutes lettres.
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

function app() {
  if (!isFirebaseConfigured) {
    throw new UserFacingError(
      "Firebase n'est pas configuré. Copie .env.example vers .env.local et remplis les valeurs."
    );
  }
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

function toAppUser(user: User): AppUser {
  return { uid: user.uid, email: user.email, displayName: user.displayName, emailVerified: user.emailVerified };
}

/** Messages en français pour les erreurs d'authentification les plus courantes. */
function friendlyAuthError(error: unknown): Error {
  if (error instanceof UserFacingError) return error;
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
      case "auth/invalid-email":
        return new UserFacingError("E-mail ou mot de passe incorrect.");
      case "auth/too-many-requests":
        return new UserFacingError("Trop de tentatives. Réessaie dans quelques minutes.");
      case "auth/network-request-failed":
        return new UserFacingError("Pas de connexion. Vérifie ton réseau et réessaie.");
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request":
        return new UserFacingError("La connexion avec Google a été annulée.");
      case "auth/popup-blocked":
        return new UserFacingError("Ton navigateur a bloqué la fenêtre Google. Autorise-la puis réessaie.");
      case "auth/email-already-in-use":
        return new UserFacingError("Un compte existe déjà avec cette adresse. Connecte-toi.");
      case "auth/weak-password":
        return new UserFacingError("Ton mot de passe est trop faible. Utilise au moins 8 caractères.");
      case "auth/user-disabled":
        return new UserFacingError("Ce compte est désactivé.");
    }
  }
  return new UserFacingError("Une erreur est survenue. Réessaie.");
}

/** Date Firestore (Timestamp) ou nombre de millisecondes : renvoie des millisecondes. */
function toMillis(value: unknown): number | null {
  if (typeof value === "number") return value;
  const stamp = value as { toMillis?: () => number } | null | undefined;
  return typeof stamp?.toMillis === "function" ? stamp.toMillis() : null;
}

function toDocData(snapshot: QueryDocumentSnapshot<DocumentData>): DocData {
  return { ...snapshot.data({ serverTimestamps: "estimate" }), id: snapshot.id };
}

export function toCourse(snapshot: QueryDocumentSnapshot<DocumentData>): Course {
  const data = snapshot.data({ serverTimestamps: "estimate" });
  const category = CATEGORIES.includes(data.category) ? (data.category as Category) : "Autre";
  return {
    id: snapshot.id,
    name: String(data.name ?? ""),
    description: String(data.description ?? ""),
    category,
    fileName: String(data.fileName ?? ""),
    fileSize: Number(data.fileSize ?? 0),
    status: data.status === "ready" ? "ready" : data.status === "error" ? "error" : "preparing",
    progress: Math.max(0, Math.min(100, Number(data.progress ?? 0))),
    examDate: typeof data.examDate === "string" ? data.examDate : null,
    createdAt: toMillis(data.createdAt) ?? Date.now(),
    lastStudiedAt: toMillis(data.lastStudiedAt),
    summary: typeof data.summary === "string" ? data.summary : undefined,
    prepStep: typeof data.prepStep === "number" ? data.prepStep : undefined,
    errorReason: typeof data.errorReason === "string" ? (data.errorReason as Course["errorReason"]) : undefined,
    dismissed: data.dismissed === true ? true : undefined,
    studyMinutes: typeof data.studyMinutes === "number" ? data.studyMinutes : undefined,
    validated: data.validated === true ? true : undefined,
  };
}

export const firebaseBackend: Backend = {
  demo: false,

  onAuthChange(callback) {
    if (!isFirebaseConfigured) {
      callback(null);
      return () => {};
    }
    return onAuthStateChanged(getAuth(app()), (user) => callback(user ? toAppUser(user) : null));
  },

  async signInWithEmail(email, password) {
    try {
      const result = await signInWithEmailAndPassword(getAuth(app()), email, password);
      return toAppUser(result.user);
    } catch (error) {
      throw friendlyAuthError(error);
    }
  },

  async signInWithGoogle() {
    try {
      const result = await signInWithPopup(getAuth(app()), new GoogleAuthProvider());
      return toAppUser(result.user);
    } catch (error) {
      throw friendlyAuthError(error);
    }
  },

  async signUpWithEmail(name, email, password) {
    try {
      const auth = getAuth(app());
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });
      await sendEmailVerification(result.user);
      return toAppUser(result.user);
    } catch (error) {
      if (error instanceof FirebaseError && error.code === "auth/invalid-email") {
        throw new UserFacingError("Cette adresse e-mail n’est pas valide.");
      }
      throw friendlyAuthError(error);
    }
  },

  async sendVerificationEmail() {
    const user = getAuth(app()).currentUser;
    if (!user) throw new UserFacingError("Ta session a expiré. Connecte-toi de nouveau.");
    try {
      await sendEmailVerification(user);
    } catch (error) {
      throw friendlyAuthError(error);
    }
  },

  async refreshUser() {
    const user = getAuth(app()).currentUser;
    if (!user) return null;
    try {
      await user.reload();
    } catch (error) {
      throw friendlyAuthError(error);
    }
    return toAppUser(user);
  },

  async discardAccount() {
    const auth = getAuth(app());
    const user = auth.currentUser;
    try {
      if (user) await deleteUser(user);
    } catch {
      await firebaseSignOut(auth);
    }
  },

  async sendPasswordReset(email) {
    try {
      await sendPasswordResetEmail(getAuth(app()), email);
    } catch (error) {
      // On ne révèle pas si une adresse a un compte : « introuvable » est traité comme un succès.
      if (error instanceof FirebaseError && error.code === "auth/user-not-found") return;
      if (error instanceof FirebaseError && error.code === "auth/invalid-email") {
        throw new UserFacingError("Cette adresse e-mail n’est pas valide.");
      }
      throw friendlyAuthError(error);
    }
  },

  async getIdToken() {
    if (!isFirebaseConfigured) return null;
    const user = getAuth(app()).currentUser;
    return user ? user.getIdToken() : null;
  },

  async signOut() {
    await firebaseSignOut(getAuth(app()));
  },

  async getProfile(uid) {
    const snapshot = await getDoc(doc(getFirestore(app()), "users", uid));
    const data = snapshot.data();
    if (!data || !data.niveau || !data.filiere || !data.universite) return null;
    return {
      niveau: data.niveau as Niveau,
      filiere: String(data.filiere),
      universite: String(data.universite),
      langue: (data.langue as Langue) ?? "fr",
    };
  },

  async saveProfile(user, profile) {
    await setDoc(
      doc(getFirestore(app()), "users", user.uid),
      {
        ...profile,
        email: user.email,
        displayName: user.displayName,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },

  onCoursesChange(uid, callback) {
    if (!isFirebaseConfigured) {
      callback([]);
      return () => {};
    }
    const q = query(collection(getFirestore(app()), "users", uid, "courses"), orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      (snapshot) => callback(snapshot.docs.map(toCourse)),
      () => callback([])
    );
  },

  async createCourse(user, input) {
    try {
      const created = await addDoc(collection(getFirestore(app()), "users", user.uid, "courses"), {
        ...input,
        status: "preparing",
        progress: 0,
        examDate: null,
        lastStudiedAt: null,
        createdAt: serverTimestamp(),
      });
      return created.id;
    } catch {
      throw new UserFacingError("Impossible d’ajouter le cours. Vérifie ta connexion et réessaie.");
    }
  },

  watchCollection(path, callback) {
    if (!isFirebaseConfigured) {
      callback([]);
      return () => {};
    }
    return onSnapshot(
      collection(getFirestore(app()), path[0], ...path.slice(1)),
      (snapshot) => callback(snapshot.docs.map(toDocData)),
      () => callback([])
    );
  },

  async listDocuments(path) {
    const snapshot = await getDocs(collection(getFirestore(app()), path[0], ...path.slice(1)));
    return snapshot.docs.map(toDocData);
  },

  async addDocument(path, data) {
    const created = await addDoc(collection(getFirestore(app()), path[0], ...path.slice(1)), data);
    return created.id;
  },

  async setDocument(path, data, merge = false) {
    await setDoc(doc(getFirestore(app()), path[0], ...path.slice(1)), data, { merge });
  },

  async updateDisplayName(user, name) {
    const current = getAuth(app()).currentUser;
    if (current) await updateProfile(current, { displayName: name });
    await setDoc(doc(getFirestore(app()), "users", user.uid), { displayName: name }, { merge: true });
  },
};
