import { backend, UserFacingError } from "@/lib/backend";

/** Adresse du backend FastAPI (variable NEXT_PUBLIC_API_URL). Vide : le backend n'est pas branché. */
export function apiUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/$/, "");
}

async function authHeaders(): Promise<Record<string, string> | null> {
  if (!apiUrl()) return null;
  const token = await backend.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
}

/** Message d'erreur prêt à montrer, tiré de la réponse du backend (champ `detail`) quand il est lisible. */
async function messageOf(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // Réponse sans JSON : on garde le message par défaut.
  }
  return fallback;
}

/**
 * Envoie le fichier d'un cours au backend, qui le lit et prépare fiche, notions et quiz en arrière-plan.
 * Renvoie false quand le backend n'est pas branché (mode démo, ou NEXT_PUBLIC_API_URL vide) : rien n'est envoyé.
 * Le fichier n'est gardé nulle part : le backend le lit en mémoire puis l'oublie.
 */
export async function sendCourseFile(courseId: string, file: File): Promise<boolean> {
  const headers = await authHeaders();
  if (!headers) return false;
  const body = new FormData();
  body.append("file", file);
  let response: Response;
  try {
    response = await fetch(`${apiUrl()}/courses/${encodeURIComponent(courseId)}/process`, { method: "POST", headers, body });
  } catch {
    throw new UserFacingError("Impossible de joindre le serveur. Vérifie ta connexion et réessaie.");
  }
  // 409 : le cours est déjà en préparation, ce qui est le résultat voulu.
  if (!response.ok && response.status !== 409) {
    throw new UserFacingError(await messageOf(response, "Le fichier n’a pas pu être envoyé. Réessaie."));
  }
  return true;
}

export interface AssistantAnswer {
  text: string;
  source?: string;
}

/** Réponse de l'assistant tirée du cours par le backend ; null si le backend n'est pas branché ou ne répond pas. */
export async function askAssistant(courseId: string, question: string): Promise<AssistantAnswer | null> {
  const headers = await authHeaders();
  if (!headers) return null;
  try {
    const response = await fetch(`${apiUrl()}/courses/${encodeURIComponent(courseId)}/assistant`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { text?: unknown; source?: unknown };
    if (typeof data.text !== "string") return null;
    return typeof data.source === "string" ? { text: data.text, source: data.source } : { text: data.text };
  } catch {
    return null;
  }
}
