import type { AppUser, Course, Profile } from "@/lib/types";
import { UserFacingError, type Backend, type DocData } from "./types";

// Mode démo : aucune donnée ne quitte le navigateur. Réservé au développement,
// quand Firebase n'est pas encore configuré. N'importe quel e-mail est accepté.
const USER_KEY = "plugstudy:demo:user";
const profileKey = (uid: string) => `plugstudy:demo:profile:${uid}`;
const listeners = new Set<(user: AppUser | null) => void>();
const coursesKey = (uid: string) => "plugstudy:demo:courses:" + uid;
const collectionListeners = new Map<string, Set<(docs: DocData[]) => void>>();

/** Les cours gardent leur clé d'origine ; les autres collections ont une clé par chemin. */
function collectionKey(path: string[]): string {
  if (path.length === 3 && path[0] === "users" && path[2] === "courses") return coursesKey(path[1]);
  return "plugstudy:demo:col:" + path.join("/");
}

function readCollection(path: string[]): DocData[] {
  try {
    const raw = window.localStorage.getItem(collectionKey(path));
    return raw ? (JSON.parse(raw) as DocData[]) : [];
  } catch {
    return [];
  }
}

function writeCollection(path: string[], docs: DocData[]) {
  window.localStorage.setItem(collectionKey(path), JSON.stringify(docs));
  collectionListeners.get(path.join("/"))?.forEach((listener) => listener(docs));
}

let counter = 0;

function readUser(): AppUser | null {
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}

function writeUser(user: AppUser | null) {
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(USER_KEY);
  listeners.forEach((listener) => listener(user));
}

function demoUid(email: string) {
  return `demo-${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export const demoBackend: Backend = {
  demo: true,

  onAuthChange(callback) {
    listeners.add(callback);
    callback(readUser());
    return () => {
      listeners.delete(callback);
    };
  },

  async signInWithEmail(email, password) {
    if (!email.trim() || !password) throw new UserFacingError("E-mail ou mot de passe incorrect.");
    const user = { uid: demoUid(email), email: email.trim(), displayName: null };
    writeUser(user);
    return user;
  },

  async signInWithGoogle() {
    const user = { uid: "demo-google", email: "demo@plugstudy.local", displayName: "Étudiant démo" };
    writeUser(user);
    return user;
  },

  async signUpWithEmail(name, email, password) {
    if (!email.trim() || password.length < 8) throw new UserFacingError("Ton mot de passe est trop faible. Utilise au moins 8 caractères.");
    const user = { uid: demoUid(email), email: email.trim(), displayName: name, emailVerified: false };
    writeUser(user);
    return user;
  },

  async sendVerificationEmail() {},

  // En démo, aucun e-mail n'est envoyé : « J'ai ouvert le lien » confirme l'adresse directement.
  async refreshUser() {
    const current = readUser();
    if (!current) return null;
    const next = { ...current, emailVerified: true };
    writeUser(next);
    return next;
  },

  async discardAccount() {
    writeUser(null);
  },

  async sendPasswordReset() {},

  async getIdToken() {
    return null;
  },

  async signOut() {
    writeUser(null);
  },

  async getProfile(uid) {
    try {
      const raw = window.localStorage.getItem(profileKey(uid));
      return raw ? (JSON.parse(raw) as Profile) : null;
    } catch {
      return null;
    }
  },

  async saveProfile(user, profile) {
    window.localStorage.setItem(profileKey(user.uid), JSON.stringify(profile));
  },

  onCoursesChange(uid, callback) {
    return this.watchCollection(["users", uid, "courses"], (docs) => callback(docs as unknown as Course[]));
  },

  async createCourse(user, input) {
    const course = {
      ...input,
      status: "preparing",
      progress: 0,
      examDate: null,
      createdAt: Date.now(),
      lastStudiedAt: null,
    };
    return this.addDocument(["users", user.uid, "courses"], course);
  },

  watchCollection(path, callback) {
    const key = path.join("/");
    const set = collectionListeners.get(key) ?? new Set();
    collectionListeners.set(key, set);
    set.add(callback);
    callback(readCollection(path));
    return () => {
      set.delete(callback);
    };
  },

  async listDocuments(path) {
    return readCollection(path);
  },

  async addDocument(path, data) {
    counter += 1;
    const id = "demo-" + Date.now() + "-" + counter;
    writeCollection(path, [...readCollection(path), { ...data, id }]);
    return id;
  },

  async setDocument(path, data, merge = false) {
    const collection = path.slice(0, -1);
    const id = path[path.length - 1];
    const docs = readCollection(collection);
    const existing = docs.find((doc) => doc.id === id);
    const next: DocData = merge && existing ? { ...existing, ...data, id } : { ...data, id };
    writeCollection(collection, existing ? docs.map((doc) => (doc.id === id ? next : doc)) : [...docs, next]);
  },

  async updateDisplayName(user, name) {
    writeUser({ ...user, displayName: name });
  },
};
