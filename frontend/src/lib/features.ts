/**
 * Fonctions visibles dans l'application.
 *
 * MVP : compte (vérification par lien), connexion, onboarding, profil modifiable, ajout d'un cours que l'IA lit,
 * notions classées de la plus à la moins importante, séance de révision et quiz.
 * Tout le reste est construit mais caché : mettre une valeur à `true` suffit à le rallumer (puis adapter les tests).
 */
export const features = {
  /** Assistant (chatbot) : écran 21, onglet IA du détail du cours, « Poser une question ». */
  assistant: false,
  /** Page Suivi (écrans 24 et 30) et sa mention dans le résultat du quiz. */
  suivi: false,
  /** Planning (écrans 22, 23, 29) : réglages, calendrier du mois, vue Semaine. */
  planning: true,
  /** « Changer la photo » dans le profil (demande un stockage de fichiers). */
  profilePhoto: false,
  /** « Supprimer mon compte » (écran 31 : confirmation en écrivant SUPPRIMER, puis suppression par le serveur). */
  deleteAccount: true,
  /**
   * Validation stricte : sous 75 % au quiz d'une notion, l'étudiant doit la réviser avant de passer à la suivante.
   * Désactivée au départ (l'objectif est l'adoption) : le renvoi à la notion est conseillé, le passage reste possible.
   */
  strictValidation: false,
  /** Cours types de la filière (catalogue pas encore créé) : un nouvel étudiant démarre sans aucun cours. */
  typicalCourses: false,
} as const;

export type Feature = keyof typeof features;
