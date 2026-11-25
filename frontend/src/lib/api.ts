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

/** Message d'erreur (français, traduit à l'affichage) choisi d'après le code HTTP, jamais d'après le texte du serveur. */
function messageForStatus(status: number): string {
  switch (status) {
    case 401:
      return "Ta session a expiré. Connecte-toi de nouveau.";
    case 413:
      return "Ce fichier est trop volumineux.";
    case 415:
      return "Ce format n’est pas pris en charge. Choisis un PDF, DOCX, PPTX ou TXT.";
    case 429:
      return "Trop de demandes. Réessaie dans une minute.";
    default:
      return "Le fichier n’a pas pu être envoyé. Réessaie.";
  }
}

/**
 * Envoie le fichier d'un cours au backend, qui le lit et prépare fiche, notions et quiz en arrière-plan.
 * Renvoie false quand le backend n'est pas branché (mode démo, ou NEXT_PUBLIC_API_URL vide) : rien n'est envoyé.
 * Le fichier n'est gardé nulle part : le backend le lit en mémoire puis l'oublie.
 */
export async function sendCourseFile(courseId: string, file: File, language: "fr" | "en" = "fr"): Promise<boolean> {
  const headers = await authHeaders();
  if (!headers) return false;
  // Sur Android, un fichier choisi depuis Téléchargements, WhatsApp ou Drive n'est lu qu'au moment de l'envoi, et le navigateur
  // l'abandonne parfois sans qu'aucune requête n'arrive au serveur. On le lit donc en mémoire d'abord, puis on envoie la copie.
  let content: Blob;
  try {
    content = new Blob([await file.arrayBuffer()], { type: file.type || "application/octet-stream" });
  } catch {
    throw new UserFacingError("Impossible de lire ce fichier. Enregistre-le sur ton téléphone, puis choisis-le de nouveau.");
  }
  const body = new FormData();
  body.append("file", content, file.name);
  body.append("language", language); // résumé, notions et quiz sont écrits dans cette langue
  // L'hébergement gratuit endort le serveur : on le réveille d'abord (sans garder le fichier en attente),
  // puis on retente une fois si le réseau coupe pendant l'envoi.
  await fetch(`${apiUrl()}/health`, { signal: AbortSignal.timeout(60_000) }).catch(() => undefined);
  let response: Response | undefined;
  for (let attempt = 0; attempt < 2 && !response; attempt++) {
    try {
      response = await fetch(`${apiUrl()}/courses/${encodeURIComponent(courseId)}/process`, { method: "POST", headers, body });
    } catch {
      response = undefined;
    }
  }
  if (!response) throw new UserFacingError("Impossible de joindre le serveur. Vérifie ta connexion et réessaie.");
  // 409 : le cours est déjà en préparation, ce qui est le résultat voulu.
  if (!response.ok && response.status !== 409) {
    throw new UserFacingError(messageForStatus(response.status));
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
