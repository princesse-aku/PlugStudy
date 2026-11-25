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
  courseProgress,
  importanceOf,
  nextMastery,
  notionScore,
  pickQuizQuestions,
  progressMessage,
  resultTitle,
  sessionNotions,
} from "@/lib/revision";
import { buildSampleContent } from "@/lib/sample-content";
import type { Course, QuizAnswer } from "@/lib/types";

// Ces tests couvrent des fonctions cachées dans le MVP : on les rallume ici (voir src/lib/features.ts).
vi.mock("@/lib/features", () => ({
  features: { assistant: true, suivi: true, planning: true, profilePhoto: true, deleteAccount: true, typicalCourses: false },
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

function seed(opts: { withContent?: boolean } = {}) {
  const { withContent = true } = opts;
  write("plugstudy:demo:user", { uid: UID, email: "honorat@gmail.com", displayName: "Honorat Dossou" });
  write(`plugstudy:demo:profile:${UID}`, { niveau: "Licence 1", filiere: "Informatique", universite: "UAC", langue: "fr" });
  write(`plugstudy:demo:courses:${UID}`, [course()]);
  if (withContent) {
    write(`plugstudy:demo:col:users/${UID}/courses/c1/notions`, notions);
    write(`plugstudy:demo:col:users/${UID}/courses/c1/questions`, questions);
  }
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

  it("choisit 4 questions, d'abord celles des notions de la séance", () => {
    const picked = pickQuizQuestions(questions, notions);
    expect(picked).toHaveLength(4);
    const inSession = new Set(sessionNotions(notions).map((n) => n.id));
    expect(picked.every((q) => inSession.has(q.notionId))).toBe(true);
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
  it("enregistre le résultat, met à jour la maîtrise et la progression", async () => {
    seed();
    const user = userEvent.setup();
    wrap(<QuizPage />);
    expect(await screen.findByText("Question 1 sur 4")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choisis une réponse" }).hasAttribute("disabled")).toBe(true);

    // Question 1 : une mauvaise réponse (A), avec l'explication « Pourquoi ce n'est pas A ».
    await user.click(screen.getByText("Le nombre de lignes du code"));
    expect(await screen.findByText("Pourquoi ce n’est pas A")).toBeTruthy();
    expect(screen.getByText("Ta réponse")).toBeTruthy();
    expect(screen.getByText("Bonne réponse")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Question suivante" }));

    // Questions 2 à 4 : les bonnes réponses (B).
    const good = [
      "Un cas de base qui arrête les appels",
      "Tant qu’une condition est vraie",
      "Les valeurs qu’elle peut contenir",
    ];
    for (const [index, choice] of good.entries()) {
      expect(await screen.findByText(`Question ${index + 2} sur 4`)).toBeTruthy();
      await user.click(screen.getByText(choice));
      const last = index === good.length - 1;
      await user.click(screen.getByRole("button", { name: last ? "Voir mon résultat" : "Question suivante" }));
    }

    await waitFor(() => expect(router.push).toHaveBeenCalled());
    const target = router.push.mock.calls[0][0] as string;
    expect(target).toMatch(/^\/cours\/c1\/resultat\?tentative=/);

    const attempts = read(`plugstudy:demo:col:users/${UID}/attempts`);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ score: 3, total: 4, courseName: "Algorithmique" });
    const saved = read(`plugstudy:demo:col:users/${UID}/courses/c1/notions`);
    expect(saved.find((n: { id: string }) => n.id === "complexite").mastery).toBe(0);
    expect(saved.find((n: { id: string }) => n.id === "recursivite").mastery).toBe(0.5);
    const [stored] = read(`plugstudy:demo:courses:${UID}`);
    expect(stored.progress).toBeGreaterThan(0);
    expect(stored.lastStudiedAt).not.toBeNull();
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
