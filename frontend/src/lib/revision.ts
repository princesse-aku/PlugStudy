import type { Notion, Question, QuizAnswer } from "@/lib/types";

export type Importance = "indispensable" | "important" | "secondaire";

/** Score de priorité d'une notion : S = 0,4·I + 0,3·F + 0,3·P (chacun entre 0 et 1). */
export function notionScore(notion: Pick<Notion, "importance" | "frequency" | "position">): number {
  return 0.4 * notion.importance + 0.3 * notion.frequency + 0.3 * notion.position;
}

/** Indispensable si S ≥ 0,7 ; Important entre 0,4 et 0,7 ; Secondaire en dessous. */
export function importanceOf(notion: Pick<Notion, "importance" | "frequency" | "position">): Importance {
  const score = notionScore(notion);
  if (score >= 0.7) return "indispensable";
  if (score >= 0.4) return "important";
  return "secondaire";
}

export const IMPORTANCE_LABEL: Record<Importance, string> = {
  indispensable: "Indispensable",
  important: "Important",
  secondaire: "Secondaire",
};

/** Notions classées de la plus à la moins prioritaire. */
export function rankNotions(notions: Notion[]): Notion[] {
  return [...notions].sort((a, b) => notionScore(b) - notionScore(a) || a.title.localeCompare(b.title, "fr"));
}

/** Notions d'une séance : les indispensables ; à défaut, les cinq premières du classement. */
export function sessionNotions(notions: Notion[]): Notion[] {
  const ranked = rankNotions(notions);
  const must = ranked.filter((notion) => importanceOf(notion) === "indispensable");
  return must.length > 0 ? must : ranked.slice(0, 5);
}

/** Progression d'un cours (0 à 100) : P = Σ S·M / Σ S, la part des notions maîtrisées pondérée par leur importance. */
export function courseProgress(notions: Notion[]): number {
  const total = notions.reduce((sum, notion) => sum + notionScore(notion), 0);
  if (total === 0) return 0;
  const mastered = notions.reduce((sum, notion) => sum + notionScore(notion) * notion.mastery, 0);
  return Math.round((mastered / total) * 100);
}

/** Maîtrise après une réponse : +0,5 si juste, −0,25 si fausse (hypothèse de départ à calibrer). */
export function nextMastery(mastery: number, correct: boolean): number {
  return correct ? Math.min(1, mastery + 0.5) : Math.max(0, mastery - 0.25);
}

export const QUIZ_LENGTH = 4;

/** Questions du quiz de fin de séance : celles des notions de la séance, les moins maîtrisées d'abord. */
export function pickQuizQuestions(questions: Question[], notions: Notion[], length = QUIZ_LENGTH): Question[] {
  const byId = new Map(notions.map((notion) => [notion.id, notion]));
  const inSession = new Set(sessionNotions(notions).map((notion) => notion.id));
  return [...questions]
    .filter((question) => byId.has(question.notionId))
    .sort((a, b) => {
      const sessionDelta = Number(inSession.has(b.notionId)) - Number(inSession.has(a.notionId));
      if (sessionDelta !== 0) return sessionDelta;
      return (byId.get(a.notionId)?.mastery ?? 0) - (byId.get(b.notionId)?.mastery ?? 0);
    })
    .slice(0, length);
}

export function scorePercent(score: number, total: number): number {
  return total === 0 ? 0 : Math.round((score / total) * 100);
}

/** Titre du résultat du quiz. */
export function resultTitle(percent: number): string {
  if (percent === 100) return "Parfait !";
  if (percent >= 75) return "Bien joué !";
  if (percent >= 50) return "Tu progresses.";
  return "Courage, on revoit ça.";
}

/** Message du Suivi selon la progression globale. */
export function progressMessage(percent: number): { title: string; text: string } {
  if (percent === 0) return { title: "Prêt à commencer ?", text: "Lance ta première séance." };
  if (percent < 40) return { title: "C’est un début !", text: "Chaque séance compte." };
  if (percent < 70) return { title: "Bien parti !", text: "Continue comme ça." };
  return { title: "Très bien !", text: "Garde le rythme." };
}

export function wrongAnswers(answers: QuizAnswer[]): QuizAnswer[] {
  return answers.filter((answer) => !answer.correct);
}

/** Maîtrise de chaque notion interrogée après un quiz, puis progression du cours. */
export function applyQuiz(notions: Notion[], answers: QuizAnswer[]): { notions: Notion[]; progress: number } {
  const updated = notions.map((notion) =>
    answers
      .filter((answer) => answer.notionId === notion.id)
      .reduce((current, answer) => ({ ...current, mastery: nextMastery(current.mastery, answer.correct) }), notion)
  );
  return { notions: updated, progress: courseProgress(updated) };
}

/** Priorité d'un cours : R = U × Σ S·(1 − M), U = urgence de l'examen (1 sans date). */
export function coursePriority(notions: Notion[], urgency = 1): number {
  return urgency * notions.reduce((sum, notion) => sum + notionScore(notion) * (1 - notion.mastery), 0);
}

/** Minuscules sans accents, pour chercher dans le cours. */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export type AssistantAction = "autrement" | "exemple" | "quiz";

export interface Reply {
  text: string;
  source?: string;
  notionId?: string;
}

const STOP_WORDS = new Set([
  "est", "quoi", "que", "qui", "quel", "quelle", "les", "des", "une", "dans", "pour", "sur", "moi", "mon",
  "ton", "explique", "donne", "peux", "tu", "elle", "ce", "cette", "ca", "aux", "autrement", "exemple",
]);

/**
 * Réponse de l'assistant à partir des seules notions du cours : recherche par mots, sans IA pour l'instant.
 * Quand rien ne correspond, il le dit au lieu d'inventer.
 */
export function answerFromCourse(question: string, notions: Notion[], courseName: string): Reply {
  const words = normalize(question)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  let best: { notion: Notion; hits: number } | null = null;
  for (const notion of notions) {
    const haystack = normalize(`${notion.title} ${notion.excerpt} ${notion.simple}`);
    const hits = words.filter((word) => haystack.includes(word)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { notion, hits };
  }
  if (!best) {
    return { text: `Je ne trouve pas ça dans ton cours ${courseName}. Ajoute un cours qui en parle et je pourrai t’aider.` };
  }
  const { notion } = best;
  return { text: `Dans ton cours : ${notion.excerpt} ${notion.simple}`, source: notion.source, notionId: notion.id };
}

/** Réponse aux actions rapides, à partir de la dernière notion dont on a parlé. */
export function answerToAction(action: AssistantAction, notion: Notion | undefined, courseName: string): Reply {
  if (!notion) {
    return { text: `Pose d’abord une question sur ton cours ${courseName}, puis je pourrai t’aider à aller plus loin.` };
  }
  if (action === "autrement") return { text: `Autrement dit : ${notion.simple}`, source: notion.source, notionId: notion.id };
  if (action === "exemple") return { text: `Un exemple : ${notion.simple}`, source: notion.source, notionId: notion.id };
  return { text: `Teste-toi sur « ${notion.title} » avec le quiz.`, source: notion.source, notionId: notion.id };
}
