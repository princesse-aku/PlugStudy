import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { router } from "./setup";
import { AuthProvider } from "@/lib/auth-context";
import NotionsPage from "@/app/cours/[id]/notions/page";
import SeancePage from "@/app/cours/[id]/seance/page";
import QuizPage from "@/app/cours/[id]/quiz/page";
import ResultatPage from "@/app/cours/[id]/resultat/page";
import AssistantPage from "@/app/cours/[id]/assistant/page";
import SuiviPage from "@/app/suivi/page";
import ProfilPage from "@/app/profil/page";
import { dailyMinutes, formatMinutes, totalMinutes, weeklyMinutes } from "@/lib/activity";
import {
  answerFromCourse,
  applyQuiz,
  courseProgress,
  generalQuizQuestions,
  generalUnlocked,
  importanceOf,
  isPassed,
  localGrade,
  nextMastery,
  nextNotionId,
  notionQuestions,
  notionQuiz,
  notionScore,
  pendingNotions,
  progressMessage,
  resultTitle,
  sessionNotions,
  writtenQuestion,
} from "@/lib/revision";
import { buildSampleContent } from "@/lib/sample-content";
import type { Course, QuizAnswer } from "@/lib/types";

// Ces tests couvrent des fonctions cachées dans le MVP : on les rallume ici (voir src/lib/features.ts).
vi.mock("@/lib/features", () => ({
  features: { assistant: true, suivi: true, planning: true, profilePhoto: true, deleteAccount: true, strictValidation: false, typicalCourses: false },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/",
  useParams: () => ({ id: "c1" }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const UID = "demo-honorat";
const wrap = (page: React.ReactNode) => render(<AuthProvider>{page}</AuthProvider>);
const { notions, questions } = buildSampleContent("Algorithmique");

const course = (over: Partial<Course> = {}): Course => ({
  id: "c1",
  name: "Algorithmique",
  description: "",
  category: "Informatique",
  fileName: "algo.pdf",
  fileSize: 1000,
  status: "ready",
  progress: 0,
  examDate: null,
  createdAt: Date.now() - 86400000,
  lastStudiedAt: null,
  ...over,
});

const read = (key: string) => JSON.parse(window.localStorage.getItem(key) ?? "null");
const write = (key: string, value: unknown) => window.localStorage.setItem(key, JSON.stringify(value));

function seed(opts: { withContent?: boolean; validated?: boolean } = {}) {
  const { withContent = true, validated = false } = opts;
  write("plugstudy:demo:user", { uid: UID, email: "honorat@gmail.com", displayName: "Honorat Dossou" });
  write(`plugstudy:demo:profile:${UID}`, { niveau: "Licence 1", filiere: "Informatique", universite: "UAC", langue: "fr" });
  write(`plugstudy:demo:courses:${UID}`, [course()]);
  if (withContent) {
    write(`plugstudy:demo:col:users/${UID}/courses/c1/notions`, validated ? notions.map((n) => ({ ...n, validated: true })) : notions);
    write(`plugstudy:demo:col:users/${UID}/courses/c1/questions`, questions);
  }
}

/** Répond à une question écrite et la fait corriger (sans backend, la correction se fait sur place). */
async function answerWritten(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByRole("textbox", { name: "Ta réponse" }), text);
  await user.click(screen.getByRole("button", { name: "Valider ma réponse" }));
}

beforeEach(() => window.history.pushState({}, "", "/"));

describe("Règles de révision", () => {
  it("calcule le score S = 0,4 I + 0,3 F + 0,3 P et l'étiquette", () => {
    expect(notionScore({ importance: 1, frequency: 1, position: 1 })).toBeCloseTo(1);
    expect(importanceOf({ importance: 1, frequency: 0.9, position: 0.9 })).toBe("indispensable");
    expect(importanceOf({ importance: 0.7, frequency: 0.6, position: 0.5 })).toBe("important");
    expect(importanceOf({ importance: 0.3, frequency: 0.3, position: 0.2 })).toBe("secondaire");
  });

  it("répartit les notions d'exemple : 10 notions dont 4 indispensables", () => {
    expect(notions).toHaveLength(10);
    expect(sessionNotions(notions)).toHaveLength(4);
  });

  it("calcule la progression P = Σ S·M / Σ S", () => {
    expect(courseProgress(notions)).toBe(0);
    expect(courseProgress(notions.map((n) => ({ ...n, mastery: 1 })))).toBe(100);
    expect(courseProgress([])).toBe(0);
    const one = { ...notions[0], mastery: 1 };
    const rest = notions.slice(1);
    const expected = Math.round((notionScore(one) / [one, ...rest].reduce((s, n) => s + notionScore(n), 0)) * 100);
    expect(courseProgress([one, ...rest])).toBe(expected);
  });

  it("met à jour la maîtrise après une réponse", () => {
    expect(nextMastery(0, true)).toBe(0.5);
    expect(nextMastery(0.8, true)).toBe(1);
    expect(nextMastery(0.5, false)).toBe(0.25);
    expect(nextMastery(0, false)).toBe(0);
  });

  it("le quiz général prend des questions de chaque notion, les mieux classées d'abord", () => {
    const picked = generalQuizQuestions(questions, notions);
    expect(new Set(picked.map((q) => q.notionId))).toEqual(new Set(questions.map((q) => q.notionId)));
    expect(picked[0].notionId).toBe(sessionNotions(notions)[0].id);
    expect(picked.length).toBeLessThanOrEqual(12);
  });

  it("le quiz général finit par trois questions écrites sur les notions les plus importantes", () => {
    const picked = generalQuizQuestions(questions, notions);
    const written = picked.filter((question) => question.kind === "written");
    expect(written).toHaveLength(3);
    expect(picked.slice(-3)).toEqual(written);
    expect(written[0].notionId).toBe(sessionNotions(notions)[0].id);
    expect(generalQuizQuestions([], notions)).toEqual([]);
  });

  it("chaque nouvelle tentative du quiz général prend d'autres questions", () => {
    const base = questions.find((question) => question.notionId === "complexite")!;
    const three = [1, 2, 3].map((n) => ({ ...base, id: `q-complexite-${n}`, text: `Question ${n}` }));
    const ids = (round: number) =>
      generalQuizQuestions(three, notions.filter((n) => n.id === "complexite"), round)
        .filter((question) => question.kind !== "written")
        .map((question) => question.id);
    expect(ids(0)).toEqual(["q-complexite-1", "q-complexite-2"]);
    expect(ids(1)).toEqual(["q-complexite-2", "q-complexite-3"]);
    expect(ids(2)).toEqual(["q-complexite-3", "q-complexite-1"]);
  });

  it("valide à partir de 75 %", () => {
    expect(isPassed(3, 4)).toBe(true);
    expect(isPassed(9, 12)).toBe(true);
    expect(isPassed(2, 3)).toBe(false);
    expect(isPassed(0, 0)).toBe(false);
  });

  it("le quiz d'une notion ajoute une question écrite, sauf quand la notion n'a aucune question", () => {
    const notion = notions.find((n) => n.id === "complexite")!;
    const quiz = notionQuiz(questions, notion);
    expect(quiz.at(-1)).toEqual(writtenQuestion(notion));
    expect(quiz.at(-1)!.kind).toBe("written");
    expect(notionQuiz([], notion)).toEqual([]);
  });

  it("le quiz général reste verrouillé tant qu'une notion indispensable n'est pas validée", () => {
    const required = sessionNotions(notions);
    expect(generalUnlocked(notions)).toBe(false);
    expect(pendingNotions(notions).map((n) => n.id)).toEqual(required.map((n) => n.id));
    const almost = notions.map((n) => ({ ...n, validated: n.id !== required[0].id ? true : undefined }));
    expect(pendingNotions(almost).map((n) => n.id)).toEqual([required[0].id]);
    expect(generalUnlocked(notions.map((n) => ({ ...n, validated: true })))).toBe(true);
    expect(generalUnlocked([])).toBe(false);
  });

  it("corrige une réponse écrite par les mots du cours quand l'IA ne répond pas", () => {
    const notion = { title: "Complexité algorithmique", simple: "Plus il y a de données, plus ça prend du temps.", excerpt: "" };
    expect(localGrade("La complexité algorithmique mesure le temps quand il y a plus de données", notion).correct).toBe(true);
    expect(localGrade("Je ne sais pas", notion).correct).toBe(false);
  });

  it("donne les messages de résultat et de suivi", () => {
    expect(resultTitle(100)).toBe("Parfait !");
    expect(resultTitle(75)).toBe("Bien joué !");
    expect(resultTitle(25)).toBe("Courage, on revoit ça.");
    expect(progressMessage(68)).toEqual({ title: "Bien parti !", text: "Continue comme ça." });
  });

  it("répond depuis le cours seulement, et dit quand il ne sait pas", () => {
    const found = answerFromCourse("C’est quoi une boucle ?", notions, "Algorithmique");
    expect(found.source).toBe("Algorithmique, chap. 2, p. 8");
    expect(found.text).toContain("tant qu’une condition est vraie");
    const none = answerFromCourse("Qui a gagné la coupe du monde ?", notions, "Algorithmique");
    expect(none.source).toBeUndefined();
    expect(none.text).toContain("Je ne trouve pas ça dans ton cours Algorithmique");
  });
});

describe("Activité", () => {
  const at = new Date(2026, 11, 9, 15, 0).getTime();
  const session = (daysAgo: number, minutes: number) => ({
    id: String(daysAgo) + minutes,
    courseId: "c1",
    notionId: "n",
    minutes,
    at: at - daysAgo * 86400000,
  });

  it("totalise les minutes des 7 derniers jours", () => {
    const bars = dailyMinutes([session(0, 25), session(0, 10), session(2, 60), session(9, 99)], at);
    expect(bars).toHaveLength(7);
    expect(bars[6].minutes).toBe(35);
    expect(bars[4].minutes).toBe(60);
    expect(totalMinutes(bars)).toBe(95);
    expect(bars[6].label).toBe("M"); // le 9 décembre 2026 est un mercredi
  });

  it("totalise les minutes des 6 dernières semaines", () => {
    const bars = weeklyMinutes([session(0, 20), session(8, 30), session(60, 99)], at);
    expect(bars).toHaveLength(6);
    expect(bars[5].minutes).toBe(20);
    expect(bars[4].minutes).toBe(30);
    expect(totalMinutes(bars)).toBe(50);
  });

  it("formate les durées", () => {
    expect(formatMinutes(0)).toBe("0 min");
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(280)).toBe("4 h 40");
    expect(formatMinutes(120)).toBe("2 h");
  });
});

describe("Notions classées (écran 18)", () => {
  it("classe les notions et propose de commencer par les indispensables", async () => {
    seed();
    const user = userEvent.setup();
    wrap(<NotionsPage />);
    expect(await screen.findByText("Complexité algorithmique")).toBeTruthy();
    expect(screen.getByText("10 notions", { selector: "b" })).toBeTruthy();
    expect(screen.getByText("4 indispensables", { selector: "b" })).toBeTruthy();
    expect(screen.getAllByText("Indispensable", { selector: "span" })).toHaveLength(4);
    expect(screen.getByText("Important", { selector: "span" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Commencer par les 4 indispensables" }).getAttribute("href")).toBe("/cours/c1/seance");
    expect(screen.queryByText("Commentaires")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Voir les 10 notions" }));
    expect(screen.getByText("Commentaires")).toBeTruthy();
  });

  it("dit quand les notions ne sont pas prêtes", async () => {
    seed({ withContent: false });
    wrap(<NotionsPage />);
    expect(await screen.findByText("Les notions de ce cours ne sont pas encore prêtes.")).toBeTruthy();
  });
});

describe("Séance de révision (écran 19)", () => {
  it("montre une notion à la fois avec l'extrait, la source et l'explication simple", async () => {
    seed();
    const user = userEvent.setup();
    wrap(<SeancePage />);
    expect(await screen.findByText("Notion 1 sur 4")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Complexité algorithmique" })).toBeTruthy();
    expect(screen.getByText("Ce que dit ton cours")).toBeTruthy();
    expect(screen.getByText("En termes simples")).toBeTruthy();
    expect(screen.getByText("Algorithmique, chap. 2, p. 14")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Notion suivante →" }));
    expect(await screen.findByText("Notion 2 sur 4")).toBeTruthy();
    // Le temps passé sur la première notion est gardé pour le Suivi.
    await waitFor(() => expect(read(`plugstudy:demo:col:users/${UID}/sessions`)).toHaveLength(1));
    expect(read(`plugstudy:demo:col:users/${UID}/sessions`)[0]).toMatchObject({ courseId: "c1", minutes: 1 });
  });

  it("permet de signaler une erreur", async () => {
    seed();
    const user = userEvent.setup();
    wrap(<SeancePage />);
    await user.click(await screen.findByRole("button", { name: "Signaler une erreur" }));
    await waitFor(() => expect(read(`plugstudy:demo:col:users/${UID}/reports`)).toHaveLength(1));
    expect(await screen.findByText("Signalé, merci")).toBeTruthy();
  });

  it("ouvre la notion demandée dans l'adresse", async () => {
    seed();
    window.history.pushState({}, "", "/?notion=boucle");
    wrap(<SeancePage />);
    expect(await screen.findByRole("heading", { name: "Boucles" })).toBeTruthy();
  });
});

describe("Quiz (écran 20) puis résultat (écran 26)", () => {
  it("le quiz général enregistre le résultat, met à jour la maîtrise et la progression", async () => {
    seed({ validated: true });
    const user = userEvent.setup();
    wrap(<QuizPage />);
    const asked = generalQuizQuestions(questions, notions);
    expect(await screen.findByText(`Question 1 sur ${asked.length}`)).toBeTruthy();
    expect(screen.getByText("Quiz général")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choisis une réponse" }).hasAttribute("disabled")).toBe(true);

    const given: QuizAnswer[] = [];
    for (const [index, question] of asked.entries()) {
      expect(await screen.findByText(`Question ${index + 1} sur ${asked.length}`)).toBeTruthy();
      expect(screen.getByRole("heading", { name: question.text })).toBeTruthy();
      const notion = notions.find((n) => n.id === question.notionId)!;
      let correct = true;
      if (question.kind === "written") {
        await answerWritten(user, `${notion.title} ${notion.simple}`);
        expect(await screen.findByText("Bien vu")).toBeTruthy();
      } else {
        // La première question : une mauvaise réponse, avec « Pourquoi ce n'est pas … » ; les autres : la bonne.
        correct = index !== 0;
        await user.click(screen.getByText(correct ? question.choices[question.correctIndex] : question.choices[(question.correctIndex + 1) % question.choices.length]));
        if (index === 0) {
          expect(await screen.findByText(/Pourquoi ce n’est pas/)).toBeTruthy();
          expect(screen.getByText("Ta réponse")).toBeTruthy();
        }
      }
      given.push({ questionId: question.id, notionId: question.notionId, notionTitle: notion.title, source: question.source, correct });
      await user.click(await screen.findByRole("button", { name: index === asked.length - 1 ? "Voir mon résultat" : "Question suivante" }));
    }

    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(router.push.mock.calls[0][0]).toMatch(/^\/cours\/c1\/resultat\?tentative=[^&]+$/); // pas de ?notion= : quiz général

    const attempts = read(`plugstudy:demo:col:users/${UID}/attempts`);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ score: asked.length - 1, total: asked.length, courseName: "Algorithmique", kind: "general" });
    expect(attempts[0].answers.filter((answer: QuizAnswer) => answer.written)).toHaveLength(3);
    expect(attempts[0].answers[0].advice).toBeTruthy(); // le conseil de la question ratée
    const saved = read(`plugstudy:demo:col:users/${UID}/courses/c1/notions`);
    for (const expected of applyQuiz(notions, given).notions) {
      expect(saved.find((n: { id: string }) => n.id === expected.id).mastery).toBe(expected.mastery);
    }
    const [stored] = read(`plugstudy:demo:courses:${UID}`);
    expect(stored.progress).toBeGreaterThan(0);
    expect(stored.lastStudiedAt).not.toBeNull();
    expect(stored.validated).toBe(true); // 10 sur 11 : au moins 75 %, le cours est validé
  }, 40000);

  it("verrouille le quiz général tant que les notions indispensables ne sont pas validées", async () => {
    seed();
    wrap(<QuizPage />);
    expect(await screen.findByText("Valide d’abord les notions indispensables")).toBeTruthy();
    expect(screen.getByText("Verrouillé")).toBeTruthy();
    const first = sessionNotions(notions)[0];
    const link = screen.getByRole("link", { name: new RegExp(first.title) });
    expect(link.getAttribute("href")).toBe(`/cours/c1/seance?notion=${first.id}`);
    expect(screen.queryByText(/Question 1 sur/)).toBeNull();
  });

  it("affiche le résultat : score, réponses et notion à revoir", async () => {
    seed();
    const answers: QuizAnswer[] = [
      { questionId: "q1", notionId: "piles", notionTitle: "Piles et files", source: "Algorithmique, chap. 1, p. 3", correct: true },
      { questionId: "q2", notionId: "recursivite", notionTitle: "Récursivité", source: "Algorithmique, chap. 3, p. 21", correct: true },
      { questionId: "q3", notionId: "dichotomie", notionTitle: "Recherche dichotomique", source: "Algorithmique, chap. 2, p. 17", correct: true },
      { questionId: "q4", notionId: "complexite", notionTitle: "Complexité algorithmique", source: "Algorithmique, chap. 2, p. 14", correct: false },
    ];
    write(`plugstudy:demo:col:users/${UID}/attempts`, [
      { id: "t1", courseId: "c1", courseName: "Algorithmique", at: Date.now(), score: 3, total: 4, answers },
    ]);
    window.history.pushState({}, "", "/?tentative=t1");
    wrap(<ResultatPage />);

    expect(await screen.findByText("Bien joué !")).toBeTruthy();
    expect(screen.getByText("3 réponses justes sur 4.")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Score : 75 %" })).toBeTruthy();
    expect(screen.getAllByText("Juste")).toHaveLength(3);
    expect(screen.getByText("À revoir", { selector: "span" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Revoir la notion" }).getAttribute("href")).toBe("/cours/c1/seance?notion=complexite");
    expect(screen.getByRole("link", { name: "Terminer" }).getAttribute("href")).toBe("/accueil");
  });

  it("dit quand le résultat est introuvable", async () => {
    seed();
    window.history.pushState({}, "", "/?tentative=nope");
    wrap(<ResultatPage />);
    expect(await screen.findByText("Ce résultat est introuvable.")).toBeTruthy();
  });
});

describe("Assistant (écran 21)", () => {
  it("répond avec le cours et cite la source", async () => {
    seed();
    const user = userEvent.setup();
    wrap(<AssistantPage />);
    expect(await screen.findByText("Les réponses viennent uniquement de ton cours Algorithmique.")).toBeTruthy();
    await user.type(screen.getByLabelText("Ta question"), "C’est quoi une boucle ?");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(await screen.findByText("Algorithmique, chap. 2, p. 8")).toBeTruthy();
    expect(screen.getByText("C’est quoi une boucle ?")).toBeTruthy();
    expect(screen.getByText(/tant qu’une condition est vraie/)).toBeTruthy();
    expect(read(`plugstudy:demo:col:users/${UID}/courses/c1/messages`)).toHaveLength(2);
  });

  it("dit quand l'information n'est pas dans le cours", async () => {
    seed();
    const user = userEvent.setup();
    wrap(<AssistantPage />);
    await user.type(await screen.findByLabelText("Ta question"), "Qui a gagné la coupe du monde ?");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(await screen.findByText(/Je ne trouve pas ça dans ton cours Algorithmique/)).toBeTruthy();
  });

  it("propose une question sur la notion en cours depuis la séance", async () => {
    seed();
    window.history.pushState({}, "", "/?notion=recursivite");
    wrap(<AssistantPage />);
    await waitFor(() => expect((screen.getByLabelText("Ta question") as HTMLInputElement).value).toBe("Peux-tu m’expliquer « Récursivité » ?"));
  });

  it("explique autrement à partir de la dernière notion", async () => {
    seed();
    const user = userEvent.setup();
    wrap(<AssistantPage />);
    await user.type(await screen.findByLabelText("Ta question"), "boucle");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    await screen.findByText("Algorithmique, chap. 2, p. 8");
    await user.click(screen.getByRole("button", { name: "Explique-moi autrement" }));
    expect(await screen.findByText(/Autrement dit : Pense à un compteur/)).toBeTruthy();
  });
});

describe("Suivi (écrans 24 et 30)", () => {
  it("affiche la progression globale, l'activité et les cours", async () => {
    seed();
    write(`plugstudy:demo:courses:${UID}`, [course({ progress: 72 })]);
    write(`plugstudy:demo:col:users/${UID}/sessions`, [
      { id: "s1", courseId: "c1", notionId: "n", minutes: 45, at: Date.now() },
    ]);
    const user = userEvent.setup();
    wrap(<SuiviPage />);
    expect(await screen.findByRole("img", { name: "Progression globale : 72 %" })).toBeTruthy();
    expect(screen.getByText("Très bien !")).toBeTruthy();
    expect(screen.getByText("Minutes de révision · 45 min sur 7 jours")).toBeTruthy();
    expect(screen.getByText("Algorithmique")).toBeTruthy();
    expect(screen.getByText(/Ce n’est pas une prédiction de note/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Semaine" }));
    expect(screen.getByText("Minutes de révision · 45 min sur 6 semaines")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Semaine" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("Profil (écran 25)", () => {
  it("garde « Enregistrer » inactif tant que rien ne change, puis enregistre", async () => {
    seed();
    const user = userEvent.setup();
    wrap(<ProfilPage />);
    const save = await screen.findByRole("button", { name: "Enregistrer les modifications" });
    expect(save.hasAttribute("disabled")).toBe(true);

    const filiere = screen.getByLabelText("Filière");
    await user.clear(filiere);
    await user.type(filiere, "Droit");
    await user.selectOptions(screen.getByLabelText("Niveau d’étude"), "Master 1");
    await user.click(screen.getByRole("button", { name: "English" }));
    expect(save.hasAttribute("disabled")).toBe(false);
    await user.click(save);

    expect(await screen.findByText("Modifications enregistrées.")).toBeTruthy();
    expect(read(`plugstudy:demo:profile:${UID}`)).toEqual({ niveau: "Master 1", filiere: "Droit", universite: "UAC", langue: "en" });
  });

  it("refuse une filière vide", async () => {
    seed();
    const user = userEvent.setup();
    wrap(<ProfilPage />);
    await user.clear(await screen.findByLabelText("Filière"));
    await user.click(screen.getByRole("button", { name: "Enregistrer les modifications" }));
    expect(await screen.findByText("Écris ta filière.")).toBeTruthy();
  });

  it("met à jour le nom affiché", async () => {
    seed();
    const user = userEvent.setup();
    wrap(<ProfilPage />);
    const nom = await screen.findByLabelText("Nom complet");
    await user.clear(nom);
    await user.type(nom, "Honorat D.");
    await user.click(screen.getByRole("button", { name: "Enregistrer les modifications" }));
    expect(await screen.findByText("Modifications enregistrées.")).toBeTruthy();
    expect(read("plugstudy:demo:user").displayName).toBe("Honorat D.");
  });

  it("propose la déconnexion et la suppression du compte", async () => {
    seed();
    wrap(<ProfilPage />);
    expect(await screen.findByRole("button", { name: "Se déconnecter" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Supprimer mon compte" }).getAttribute("href")).toBe("/profil/suppression");
  });
});


describe("Un quiz par notion", () => {
  const base = questions.find((question) => question.notionId === "complexite")!;
  const extra = [2, 3, 4].map((n) => ({ ...base, id: `q-complexite-${n}`, text: `Autre question ${n} sur la complexité ?` }));
  const withExtra = () => {
    seed();
    write(`plugstudy:demo:col:users/${UID}/courses/c1/questions`, [...questions, ...extra]);
  };

  it("ne garde que les questions de la notion, trois au plus et dans l'ordre", () => {
    const picked = notionQuestions([...questions, ...extra].reverse(), "complexite");
    expect(picked.map((question) => question.id)).toEqual(["q-complexite", "q-complexite-2", "q-complexite-3"]);
    expect(picked.every((question) => question.notionId === "complexite")).toBe(true);
    expect(notionQuestions(questions, "inconnue")).toEqual([]);
  });

  it("donne la notion suivante de la séance, et rien après la dernière", () => {
    const session = sessionNotions(notions);
    expect(nextNotionId(notions, session[0].id)).toBe(session[1].id);
    expect(nextNotionId(notions, session[session.length - 1].id)).toBeNull();
    expect(nextNotionId(notions, "inconnue")).toBeNull();
  });

  it("la séance envoie vers le quiz de la notion affichée", async () => {
    seed();
    const user = userEvent.setup();
    wrap(<SeancePage />);
    const first = sessionNotions(notions)[0];
    await screen.findByRole("heading", { name: first.title });
    await user.click(screen.getByRole("button", { name: "Passer au quiz" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/cours/c1/quiz?notion=${first.id}`));
  });

  const complexite = notions.find((notion) => notion.id === "complexite")!;

  async function playNotionQuiz(user: ReturnType<typeof userEvent.setup>, goodChoices: number, writtenText: string) {
    for (let n = 1; n <= 3; n++) {
      await screen.findByText(new RegExp(`Question ${n} sur 4`));
      const right = base.choices[base.correctIndex];
      const wrong = base.choices[(base.correctIndex + 1) % base.choices.length];
      await user.click(screen.getByText(n <= goodChoices ? right : wrong));
      await user.click(screen.getByRole("button", { name: "Question suivante" }));
    }
    await screen.findByText(/Question 4 sur 4/);
    await answerWritten(user, writtenText);
    await user.click(await screen.findByRole("button", { name: "Voir mon résultat" }));
    await waitFor(() => expect(router.push).toHaveBeenCalled());
  }

  it("le quiz ne pose que les questions de la notion révisée, puis une question écrite", async () => {
    withExtra();
    window.history.pushState({}, "", "/?notion=complexite");
    const user = userEvent.setup();
    wrap(<QuizPage />);
    expect(await screen.findByText(/Question 1 sur 4/)).toBeTruthy(); // 3 questions à choix retenues sur 4, puis une écrite
    expect(screen.getByText("Quiz sur la notion")).toBeTruthy();
    expect(screen.getByText(/Complexité algorithmique · Question 1 sur 4/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: base.text })).toBeTruthy();

    await playNotionQuiz(user, 3, `${complexite.title} ${complexite.simple}`);
    expect(router.push.mock.calls[0][0]).toMatch(/^\/cours\/c1\/resultat\?tentative=.+&notion=complexite$/);
    const [attempt] = read(`plugstudy:demo:col:users/${UID}/attempts`);
    expect(attempt).toMatchObject({ total: 4, score: 4, kind: "notion" });
    expect(attempt.answers.every((answer: QuizAnswer) => answer.notionId === "complexite")).toBe(true);
    expect(attempt.answers[3].written).toBe(true);
  });

  it("valide la notion à partir de 75 %", async () => {
    withExtra();
    window.history.pushState({}, "", "/?notion=complexite");
    const user = userEvent.setup();
    wrap(<QuizPage />);
    await playNotionQuiz(user, 3, "Je ne sais pas"); // 3 sur 4 : 75 %
    const saved = read(`plugstudy:demo:col:users/${UID}/courses/c1/notions`);
    expect(saved.find((n: { id: string }) => n.id === "complexite").validated).toBe(true);
  });

  it("ne valide pas la notion sous 75 % et garde un conseil pour chaque erreur", async () => {
    withExtra();
    window.history.pushState({}, "", "/?notion=complexite");
    const user = userEvent.setup();
    wrap(<QuizPage />);
    await playNotionQuiz(user, 2, "Je ne sais pas"); // 2 sur 4 : 50 %
    const saved = read(`plugstudy:demo:col:users/${UID}/courses/c1/notions`);
    expect(saved.find((n: { id: string }) => n.id === "complexite").validated).toBeUndefined();
    const [attempt] = read(`plugstudy:demo:col:users/${UID}/attempts`);
    const wrong = attempt.answers.filter((answer: QuizAnswer) => !answer.correct);
    expect(wrong).toHaveLength(2);
    expect(wrong.every((answer: QuizAnswer) => answer.advice)).toBe(true);
  });

  it("une notion sans question passe à la suivante au lieu de bloquer", async () => {
    seed();
    write(`plugstudy:demo:col:users/${UID}/courses/c1/questions`, questions.filter((question) => question.notionId !== "complexite"));
    window.history.pushState({}, "", "/?notion=complexite");
    wrap(<QuizPage />);
    expect(await screen.findByText("Cette notion n’a pas encore de questions.")).toBeTruthy();
    const next = nextNotionId(notions, "complexite");
    expect(screen.getByRole("link", { name: "Notion suivante" }).getAttribute("href")).toBe(`/cours/c1/seance?notion=${next}`);
  });

  const attemptOn = (notionId: string, correct: boolean) => ({
    id: "t1",
    courseId: "c1",
    courseName: "Algorithmique",
    at: Date.now(),
    score: correct ? 1 : 0,
    total: 1,
    answers: [{ questionId: "q", notionId, notionTitle: "La notion", source: "Algorithmique, p. 1", correct }],
  });

  it("le résultat propose la notion suivante, puis terminer", async () => {
    seed();
    const session = sessionNotions(notions);
    write(`plugstudy:demo:col:users/${UID}/attempts`, [attemptOn(session[0].id, true)]);
    window.history.pushState({}, "", `/?tentative=t1&notion=${session[0].id}`);
    wrap(<ResultatPage />);
    const next = await screen.findByRole("link", { name: "Notion suivante" });
    expect(next.getAttribute("href")).toBe(`/cours/c1/seance?notion=${session[1].id}`);
    expect(screen.getByRole("link", { name: "Terminer" }).getAttribute("href")).toBe("/accueil");
    expect(screen.queryByRole("link", { name: "Revoir la notion" })).toBeNull();
  });

  it("le résultat de la dernière notion propose le quiz général, et revoir si besoin", async () => {
    seed({ validated: true });
    const session = sessionNotions(notions);
    const last = session[session.length - 1];
    write(`plugstudy:demo:col:users/${UID}/attempts`, [attemptOn(last.id, false)]);
    window.history.pushState({}, "", `/?tentative=t1&notion=${last.id}`);
    wrap(<ResultatPage />);
    expect(await screen.findByRole("link", { name: "Revoir la notion" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Notion suivante" })).toBeNull();
    expect(screen.getByRole("link", { name: "Passer au quiz général" }).getAttribute("href")).toBe("/cours/c1/quiz");
    expect(screen.getByRole("link", { name: "Terminer" })).toBeTruthy();
  });

  it("un cadenas remplace le quiz général tant que des notions restent à valider", async () => {
    seed();
    const session = sessionNotions(notions);
    const last = session[session.length - 1];
    write(`plugstudy:demo:col:users/${UID}/attempts`, [attemptOn(last.id, true)]);
    window.history.pushState({}, "", `/?tentative=t1&notion=${last.id}`);
    wrap(<ResultatPage />);
    expect((await screen.findByRole("link", { name: "Notions à valider" })).getAttribute("href")).toBe("/cours/c1/quiz");
    expect(screen.queryByRole("link", { name: "Passer au quiz général" })).toBeNull();
  });

  it("notion réussie : elle est validée et on passe à la suivante", async () => {
    seed();
    const session = sessionNotions(notions);
    write(`plugstudy:demo:col:users/${UID}/attempts`, [attemptOn(session[0].id, true)]);
    window.history.pushState({}, "", `/?tentative=t1&notion=${session[0].id}`);
    wrap(<ResultatPage />);
    expect(await screen.findByText("Notion validée")).toBeTruthy();
    const links = screen.getAllByRole("link").map((link) => link.textContent);
    expect(links.indexOf("Notion suivante")).toBeLessThan(links.indexOf("Terminer")); // « Notion suivante » vient en premier, mis en avant
  });

  it("notion ratée : renvoyée à la notion avec un conseil, sans bloquer le passage", async () => {
    seed();
    const session = sessionNotions(notions);
    write(`plugstudy:demo:col:users/${UID}/attempts`, [
      {
        ...attemptOn(session[0].id, false),
        kind: "notion",
        answers: [
          { questionId: "q", notionId: session[0].id, notionTitle: "La notion", source: "Algorithmique, p. 1", correct: false, advice: "Tu as confondu la pile et la file." },
        ],
      },
    ]);
    window.history.pushState({}, "", `/?tentative=t1&notion=${session[0].id}`);
    wrap(<ResultatPage />);
    expect(await screen.findByText("Notion pas encore validée")).toBeTruthy();
    expect(screen.getByText("Un conseil")).toBeTruthy();
    expect(screen.getByText("Tu as confondu la pile et la file.")).toBeTruthy();
    const links = screen.getAllByRole("link").map((link) => link.textContent);
    expect(links).toContain("Notion suivante"); // validation souple : on peut quand même avancer
    expect(links.indexOf("Revoir la notion")).toBeLessThan(links.indexOf("Notion suivante")); // d'abord la notion à revoir
  });

  it("quiz général raté : on peut le refaire, avec une nouvelle tentative", async () => {
    seed({ validated: true });
    write(`plugstudy:demo:col:users/${UID}/attempts`, [{ ...attemptOn("piles", false), kind: "general" }]);
    window.history.pushState({}, "", "/?tentative=t1");
    wrap(<ResultatPage />);
    expect(await screen.findByText("Cours pas encore validé")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Refaire le quiz général" }).getAttribute("href")).toBe("/cours/c1/quiz?essai=1");
  });

  it("une nouvelle tentative du quiz général reformule les questions et en change", async () => {
    seed({ validated: true });
    window.history.pushState({}, "", "/?essai=1");
    wrap(<QuizPage />);
    const asked = generalQuizQuestions(questions, notions, 1);
    expect(await screen.findByText(`Question 1 sur ${asked.length}`)).toBeTruthy();
  });
});
