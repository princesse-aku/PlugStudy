import type { Profile } from "@/lib/types";

/**
 * Prépare les « cours types » de la filière de l'étudiant.
 *
 * À faire (étape « Cours »): le catalogue de cours types par filière et par niveau
 * n'existe pas encore. En attendant, aucun cours n'est créé : l'accueil montrera
 * l'état « Accueil vide » (écran 27 du design).
 */
export async function prepareTypicalCourses(profile: Profile): Promise<{ created: number }> {
  void profile;
  return { created: 0 };
}
