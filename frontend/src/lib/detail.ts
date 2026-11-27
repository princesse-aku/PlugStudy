import { isDone } from "@/lib/courses";
import { rankNotions, scorePercent } from "@/lib/revision";
import { translate, type Lang } from "@/lib/i18n/translate";
import { shortDate } from "@/lib/time";
import type { Attempt, Course, Message, Notion } from "@/lib/types";

export const PREP_STEPS = ["Lecture du fichier", "Fiche résumée", "Quiz", "Plan de révision"] as const;
export type StepState = "done" | "current" | "todo";

/** État de chaque étape de préparation : les premières sont faites, la suivante est en cours, le reste attend. */
export function prepSteps(course: Pick<Course, "prepStep">): { label: string; state: StepState }[] {
  const finished = Math.max(0, Math.min(PREP_STEPS.length, course.prepStep ?? 0));
  return PREP_STEPS.map((label, index) => ({
    label,
    state: index < finished ? "done" : index === finished ? "current" : "todo",
  }));
}

/** Sous-titre de l'en-tête : « Examen le 12 déc. · En cours » (ou « Ajouté à l'instant » pendant la préparation). */
export function courseSubtitle(course: Course, addedAgo: string, lang: Lang = "fr"): string {
  if (course.status === "preparing") return translate("Ajouté {when}", lang, { when: addedAgo });
  if (course.status === "error") return translate("Préparation impossible", lang);
  const exam = course.examDate
    ? translate("Examen le {date}", lang, { date: shortDate(course.examDate, lang) })
    : translate("Pas de date d’examen", lang);
  return `${exam} · ${isDone(course) ? translate("Terminé", lang) : translate("En cours", lang)}`;
}

/** Moyenne des quiz du cours, en pourcentage (null sans quiz). */
export function averageQuizScore(attempts: Attempt[]): number | null {
  if (attempts.length === 0) return null;
  const total = attempts.reduce((sum, attempt) => sum + scorePercent(attempt.score, attempt.total), 0);
  return Math.round(total / attempts.length);
}

/** « À renforcer » : notions déjà interrogées dont la maîtrise est inférieure à 80 %, les plus faibles d'abord. */
export function notionsToStrengthen(notions: Notion[], attempts: Attempt[], limit = 2): Notion[] {
  const asked = new Set(attempts.flatMap((attempt) => attempt.answers.map((answer) => answer.notionId)));
  return notions
    .filter((notion) => asked.has(notion.id) && notion.mastery < 0.8)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, limit);
}

/** Trois questions pour démarrer, tirées des notions les plus importantes. */
export function starterQuestions(notions: Notion[], lang: Lang = "fr"): string[] {
  const top = rankNotions(notions).slice(0, 3);
  const questions: string[] = [];
  if (top[0]) questions.push(translate("C’est quoi « {title} » ?", lang, { title: top[0].title }));
  if (top[1]) questions.push(translate("Explique-moi « {title} »", lang, { title: top[1].title }));
  if (top[2]) questions.push(translate("Fais-moi un quiz sur « {title} »", lang, { title: top[2].title }));
  return questions;
}

/** Dernières questions posées à l'assistant, sans doublon, la plus récente d'abord. */
export function recentConversations(messages: Message[], limit = 2): { text: string; at: number }[] {
  const seen = new Set<string>();
  const result: { text: string; at: number }[] = [];
  for (const message of [...messages].sort((a, b) => b.at - a.at)) {
    if (message.role !== "user" || seen.has(message.text)) continue;
    seen.add(message.text);
    result.push({ text: message.text, at: message.at });
    if (result.length === limit) break;
  }
  return result;
}

/** Message d'une préparation qui a échoué (écran « Erreur d'import ») : la raison et quoi faire. Textes français : l'écran les traduit avec t(). */
export function errorMessage(reason: Course["errorReason"]): { title: string; text: string } {
  switch (reason) {
    case "unreadable":
      return {
        title: "Impossible de lire ce fichier",
        text: "Le fichier ressemble à une image (PDF scanné ou photo). Choisis un PDF ou un Word avec du texte.",
      };
    case "format":
      return {
        title: "Ce fichier n’a pas pu être ouvert",
        text: "Formats acceptés : PDF, DOCX, PPTX ou TXT. Les anciens fichiers PPT doivent être enregistrés en PPTX.",
      };
    case "empty":
      return {
        title: "Aucune notion trouvée",
        text: "Nous n’avons pas trouvé de notions dans ce fichier. Vérifie qu’il contient bien du cours.",
      };
    case "ai":
      return {
        title: "L’IA est momentanément indisponible",
        text: "Réessaie dans un instant en ajoutant de nouveau ton fichier.",
      };
    case "stalled":
      return {
        title: "La préparation a pris trop de temps",
        text: "La préparation s’est interrompue. Ajoute de nouveau ton fichier : cela prend environ une minute.",
      };
    default:
      return { title: "La préparation a échoué", text: "Réessaie en ajoutant de nouveau ton fichier." };
  }
}
