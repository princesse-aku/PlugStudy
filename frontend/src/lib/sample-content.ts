import type { Notion, Question } from "@/lib/types";

/**
 * Contenu d'exemple (notions et questions) pour tester le parcours de révision.
 *
 * Ce n'est PAS le contenu du fichier de l'étudiant : tant que le backend d'IA n'existe pas, rien ne lit les cours.
 * Il n'est proposé qu'en développement (voir `sampleContentAvailable`) et ne sert qu'à voir les écrans.
 */
export const sampleContentAvailable = process.env.NODE_ENV !== "production";

/** Résumé d'exemple (onglet Fiche). */
export const SAMPLE_SUMMARY =
  "Ce cours montre comment écrire un algorithme : variables, conditions, boucles et fonctions. Il introduit ensuite la complexité pour comparer deux solutions.";

type Seed = Omit<Notion, "id" | "mastery" | "source"> & { key: string; page: string };

const NOTIONS: Seed[] = [
  {
    key: "complexite",
    page: "chap. 2, p. 14",
    title: "Complexité algorithmique",
    excerpt:
      "Elle décrit comment le temps d’exécution d’un algorithme augmente quand la taille des données augmente.",
    simple:
      "Chercher un nom en lisant une liste de 1 000 noms un par un demande jusqu’à 1 000 étapes. Avec une liste triée, la recherche par moitiés en demande environ 10.",
    importance: 1,
    frequency: 0.9,
    position: 0.9,
  },
  {
    key: "recursivite",
    page: "chap. 3, p. 21",
    title: "Récursivité",
    excerpt: "Une fonction récursive s’appelle elle-même sur un problème plus petit, jusqu’à un cas de base qui l’arrête.",
    simple: "C’est comme des poupées russes : chaque poupée contient une version plus petite, jusqu’à la dernière qui s’ouvre sans rien dedans.",
    importance: 0.95,
    frequency: 0.85,
    position: 0.8,
  },
  {
    key: "boucle",
    page: "chap. 2, p. 8",
    title: "Boucles",
    excerpt: "Une boucle répète des instructions tant qu’une condition est vraie.",
    simple: "Pense à un compteur : tant qu’il n’a pas atteint 3, tu refais la même action. La boucle, c’est ce « tant que ».",
    importance: 0.9,
    frequency: 0.9,
    position: 0.7,
  },
  {
    key: "variables",
    page: "chap. 1, p. 5",
    title: "Variables et types",
    excerpt: "Une variable est un nom qui désigne une valeur en mémoire ; son type dit quelles valeurs elle peut contenir.",
    simple: "Une variable, c’est une boîte étiquetée : l’étiquette est le nom, et le type dit ce qu’on peut y ranger.",
    importance: 0.85,
    frequency: 0.9,
    position: 0.65,
  },
  {
    key: "dichotomie",
    page: "chap. 2, p. 17",
    title: "Recherche dichotomique",
    excerpt: "Dans une liste triée, on compare à l’élément du milieu pour éliminer la moitié des possibilités à chaque étape.",
    simple: "Pour trouver un mot dans un dictionnaire, tu l’ouvres au milieu, puis tu gardes la bonne moitié, et ainsi de suite.",
    importance: 0.7,
    frequency: 0.6,
    position: 0.5,
  },
  {
    key: "tris",
    page: "chap. 2, p. 19",
    title: "Tris par comparaison",
    excerpt: "Les tris par comparaison ordonnent une liste en comparant ses éléments deux à deux.",
    simple: "Ranger des cartes en les comparant deux par deux jusqu’à ce que tout soit dans l’ordre.",
    importance: 0.65,
    frequency: 0.6,
    position: 0.55,
  },
  {
    key: "tableaux",
    page: "chap. 1, p. 9",
    title: "Tableaux",
    excerpt: "Un tableau range plusieurs valeurs du même type, repérées par leur position.",
    simple: "Une rangée de casiers numérotés : tu retrouves chaque valeur grâce au numéro de son casier.",
    importance: 0.6,
    frequency: 0.5,
    position: 0.4,
  },
  {
    key: "piles",
    page: "chap. 1, p. 3",
    title: "Piles et files",
    excerpt: "Une pile retire le dernier élément ajouté ; une file retire le premier.",
    simple: "Une pile d’assiettes : on prend celle du dessus. Une file d’attente : le premier arrivé est le premier servi.",
    importance: 0.3,
    frequency: 0.3,
    position: 0.2,
  },
  {
    key: "pseudo",
    page: "chap. 1, p. 2",
    title: "Pseudo-code",
    excerpt: "Le pseudo-code décrit un algorithme en langage presque naturel, sans dépendre d’un langage de programmation.",
    simple: "Une recette écrite avec tes mots, assez précise pour être suivie par n’importe quel cuisinier.",
    importance: 0.3,
    frequency: 0.4,
    position: 0.2,
  },
  {
    key: "commentaires",
    page: "chap. 1, p. 4",
    title: "Commentaires",
    excerpt: "Les commentaires expliquent le code aux lecteurs ; ils ne sont pas exécutés.",
    simple: "Les notes dans la marge d’un livre : elles aident à comprendre mais ne font pas partie du texte.",
    importance: 0.2,
    frequency: 0.3,
    position: 0.1,
  },
];

interface QuestionSeed {
  notion: string;
  text: string;
  choices: [string, string, string, string];
  correct: number;
  why: string;
}

const QUESTIONS: QuestionSeed[] = [
  {
    notion: "complexite",
    text: "Que décrit la complexité d’un algorithme ?",
    choices: [
      "Le nombre de lignes du code",
      "L’évolution du temps d’exécution selon la taille des données",
      "La vitesse du processeur",
      "Le langage de programmation utilisé",
    ],
    correct: 1,
    why: "La complexité ne dépend ni de la longueur du code ni de la machine : elle décrit comment le coût d’exécution grandit quand les données grandissent.",
  },
  {
    notion: "recursivite",
    text: "Que faut-il toujours prévoir dans une fonction récursive ?",
    choices: ["Une boucle", "Un cas de base qui arrête les appels", "Un tableau", "Un commentaire"],
    correct: 1,
    why: "Sans cas de base, la fonction s’appelle sans fin. Le cas de base est ce qui arrête la récursivité.",
  },
  {
    notion: "boucle",
    text: "Une boucle répète des instructions…",
    choices: ["Une seule fois", "Tant qu’une condition est vraie", "Jamais", "Seulement au début du programme"],
    correct: 1,
    why: "Une boucle revérifie sa condition avant chaque tour et s’arrête dès qu’elle devient fausse.",
  },
  {
    notion: "variables",
    text: "Que désigne le type d’une variable ?",
    choices: ["Son nom", "Les valeurs qu’elle peut contenir", "Sa position dans le code", "Sa couleur"],
    correct: 1,
    why: "Le nom identifie la variable ; le type dit quelles valeurs elle peut recevoir (entier, texte…).",
  },
  {
    notion: "dichotomie",
    text: "À quelle condition peut-on utiliser la recherche dichotomique ?",
    choices: ["La liste est triée", "La liste est vide", "La liste contient des mots", "La liste est très courte"],
    correct: 0,
    why: "On élimine la moitié de la liste en comparant au milieu : cela n’a de sens que si la liste est triée.",
  },
  {
    notion: "tris",
    text: "Que fait un tri par comparaison ?",
    choices: [
      "Il supprime les doublons",
      "Il ordonne une liste en comparant ses éléments deux à deux",
      "Il traduit le code",
      "Il compte les éléments",
    ],
    correct: 1,
    why: "Le principe du tri par comparaison est de décider de l’ordre en comparant des paires d’éléments.",
  },
  {
    notion: "tableaux",
    text: "Comment retrouve-t-on une valeur dans un tableau ?",
    choices: ["Par sa couleur", "Par sa position", "Au hasard", "Par son poids"],
    correct: 1,
    why: "Chaque valeur d’un tableau est repérée par sa position (son indice).",
  },
  {
    notion: "piles",
    text: "Dans une pile, quel élément est retiré en premier ?",
    choices: ["Le premier ajouté", "Le dernier ajouté", "Le plus grand", "Un élément au hasard"],
    correct: 1,
    why: "Une pile fonctionne en « dernier arrivé, premier sorti » ; c’est la file qui retire le premier ajouté.",
  },
];

/** Notions et questions d'exemple, avec la source au nom du cours. */
export function buildSampleContent(courseName: string): { notions: Notion[]; questions: Question[] } {
  const notions: Notion[] = NOTIONS.map(({ key, page, ...rest }) => ({
    ...rest,
    id: key,
    source: courseName + ", " + page,
    mastery: 0,
  }));
  const sourceOf = (id: string) => notions.find((notion) => notion.id === id)?.source ?? courseName;
  const questions: Question[] = QUESTIONS.map((question) => ({
    id: "q-" + question.notion,
    notionId: question.notion,
    text: question.text,
    choices: [...question.choices],
    correctIndex: question.correct,
    explanation: question.why,
    source: sourceOf(question.notion),
  }));
  return { notions, questions };
}
