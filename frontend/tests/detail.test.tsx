import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { router } from "./setup";
import { AuthProvider } from "@/lib/auth-context";
import CoursDetailPage from "@/app/cours/[id]/page";
import AssistantPage from "@/app/cours/[id]/assistant/page";
import {
  averageQuizScore,
  courseSubtitle,
  notionsToStrengthen,
  prepSteps,
  recentConversations,
  starterQuestions,
} from "@/lib/detail";
import { buildSampleContent, SAMPLE_SUMMARY } from "@/lib/sample-content";
import { dayLabel } from "@/lib/time";
import type { Attempt, Course, Message } from "@/lib/types";

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
const write = (key: string, value: unknown) => window.localStorage.setItem(key, JSON.stringify(value));
const read = (key: string) => JSON.parse(window.localStorage.getItem(key) ?? "null");

const course = (over: Partial<Course> = {}): Course => ({
  id: "c1",
  name: "Algorithmique",
  description: "",
  category: "Informatique",
  fileName: "algo.pdf",
  fileSize: 1000,
  status: "ready",
  progress: 72,
  examDate: "2026-12-12",
  createdAt: Date.now() - 86400000,
  lastStudiedAt: null,
  summary: SAMPLE_SUMMARY,
  prepStep: 4,
  ...over,
});

const attempt = (id: string, score: number, ids: string[]): Attempt => ({
  id,
  courseId: "c1",
  courseName: "Algorithmique",
  at: Date.now() - 3600000,
  score,
  total: 4,
  answers: ids.map((notionId, index) => ({
    questionId: `q${index}`,
    notionId,
    notionTitle: notionId,
    source: "s",
    correct: index < score,
  })),
});

function seed(opts: { course?: Partial<Course>; content?: boolean } = {}) {
  write("plugstudy:demo:user", { uid: UID, email: "honorat@gmail.com", displayName: "Honorat Dossou" });
  write(`plugstudy:demo:profile:${UID}`, { niveau: "Licence 1", filiere: "Informatique", universite: "UAC", langue: "fr" });
  write(`plugstudy:demo:courses:${UID}`, [course(opts.course)]);
  if (opts.content !== false) {
    write(`plugstudy:demo:col:users/${UID}/courses/c1/notions`, notions);
    write(`plugstudy:demo:col:users/${UID}/courses/c1/questions`, questions);
  }
}

beforeEach(() => window.history.pushState({}, "", "/"));

describe("Règles du détail du cours", () => {
  it("détaille les étapes de préparation", () => {
    expect(prepSteps({ prepStep: undefined }).map((s) => s.state)).toEqual(["current", "todo", "todo", "todo"]);
    expect(prepSteps({ prepStep: 1 }).map((s) => s.state)).toEqual(["done", "current", "todo", "todo"]);
    expect(prepSteps({ prepStep: 4 }).every((s) => s.state === "done")).toBe(true);
  });

  it("écrit le sous-titre de l'en-tête", () => {
    expect(courseSubtitle(course({ status: "preparing" }), "à l’instant")).toBe("Ajouté à l’instant");
    expect(courseSubtitle(course(), "")).toBe("Examen le 12 déc. · En cours");
    expect(courseSubtitle(course({ examDate: null, progress: 100 }), "")).toBe("Pas de date d’examen · Terminé");
  });

  it("calcule la moyenne des quiz et les notions à renforcer", () => {
    expect(averageQuizScore([])).toBeNull();
    expect(averageQuizScore([attempt("a", 4, []), attempt("b", 2, [])])).toBe(75);
    const weak = notions.map((n) => (n.id === "piles" ? { ...n, mastery: 0.5 } : n.id === "boucle" ? { ...n, mastery: 0.25 } : { ...n, mastery: 1 }));
    const result = notionsToStrengthen(weak, [attempt("a", 2, ["piles", "boucle", "recursivite"])]);
    expect(result.map((n) => n.id)).toEqual(["boucle", "piles"]);
    expect(notionsToStrengthen(weak, [])).toEqual([]);
  });

  it("propose trois questions pour démarrer", () => {
    const questionsToAsk = starterQuestions(notions);
    expect(questionsToAsk).toEqual([
      "C’est quoi « Complexité algorithmique » ?",
      "Explique-moi « Récursivité »",
      "Fais-moi un quiz sur « Boucles »",
    ]);
  });

  it("garde les dernières questions sans doublon", () => {
    const now = Date.now();
    const message = (id: string, role: Message["role"], text: string, at: number): Message => ({ id, role, text, at });
    const list = [
      message("1", "user", "A ?", now - 3000),
      message("2", "assistant", "réponse", now - 2900),
      message("3", "user", "B ?", now - 2000),
      message("4", "user", "A ?", now - 1000),
    ];
    expect(recentConversations(list).map((c) => c.text)).toEqual(["A ?", "B ?"]);
  });

  it("nomme les jours", () => {
    const now = new Date(2026, 11, 9, 15, 0).getTime();
    expect(dayLabel(now - 3600000, now)).toBe("Aujourd’hui");
    expect(dayLabel(now - 86400000, now)).toBe("Hier");
    expect(dayLabel(now - 3 * 86400000, now)).toBe("Il y a 3 jours");
  });
});

describe("Détail du cours : en préparation (écran 14)", () => {
  it("montre l'avancement et verrouille les onglets", async () => {
    // Récent : au-delà de 10 minutes, un cours en préparation est montré comme bloqué.
    seed({ course: { status: "preparing", progress: 0, prepStep: 1, summary: undefined, createdAt: Date.now() - 120000 }, content: false });
    wrap(<CoursDetailPage />);
    expect(await screen.findByText("On prépare ton cours")).toBeTruthy();
    expect(screen.getByText(/^Ajouté/)).toBeTruthy();
    const steps = screen.getAllByRole("listitem");
    expect(within(steps[0]).getByText(/terminé/)).toBeTruthy();
    expect(within(steps[1]).getByText(/en cours/)).toBeTruthy();
    expect(within(steps[2]).getByText(/à venir/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Quiz" })).toBeNull();
    expect(screen.getByText("Quiz", { selector: "span[aria-disabled]" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réviser ce cours" }).hasAttribute("disabled")).toBe(true);
  });

  it("propose le contenu d'exemple (développement) puis passe à la fiche", async () => {
    seed({ course: { status: "preparing", progress: 0, prepStep: 0, summary: undefined, createdAt: Date.now() - 120000 }, content: false });
    const user = userEvent.setup();
    wrap(<CoursDetailPage />);
    await user.click(await screen.findByRole("button", { name: "Remplir avec un contenu d’exemple" }));
    expect(await screen.findByText("Résumé du cours")).toBeTruthy();
    expect(read(`plugstudy:demo:col:users/${UID}/courses/c1/notions`)).toHaveLength(10);
    expect(read(`plugstudy:demo:col:users/${UID}/courses/c1/questions`)).toHaveLength(8);
    expect(read(`plugstudy:demo:courses:${UID}`)[0]).toMatchObject({ status: "ready", prepStep: 4 });
  });
});

describe("Détail du cours : Fiche (écran 15)", () => {
  it("montre le résumé, trois notions et le bouton pour réviser", async () => {
    seed();
    wrap(<CoursDetailPage />);
    expect(await screen.findByText("Résumé du cours")).toBeTruthy();
    expect(screen.getByText("Examen le 12 déc. · En cours")).toBeTruthy();
    expect(screen.getByText(/Ce cours montre comment écrire un algorithme/)).toBeTruthy();
    expect(screen.getByText("Généré par l’IA à partir de ton fichier. Vérifie avec ton cours.")).toBeTruthy();
    expect(await screen.findByText("Complexité algorithmique")).toBeTruthy();
    expect(screen.getByText("Récursivité")).toBeTruthy();
    expect(screen.queryByText("Commentaires")).toBeNull();
    expect((await screen.findByRole("link", { name: "Voir les 10" })).getAttribute("href")).toBe("/cours/c1/notions");
    expect(screen.getByRole("link", { name: "Réviser ce cours" }).getAttribute("href")).toBe("/cours/c1/seance");
    expect(screen.getByRole("link", { name: "Fiche" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Quiz" }).getAttribute("href")).toBe("/cours/c1?onglet=quiz");
    expect(screen.getByRole("link", { name: "IA" }).getAttribute("href")).toBe("/cours/c1?onglet=ia");
  });
});

describe("Détail du cours : Quiz (écran 16)", () => {
  it("montre les quiz faits, la moyenne et les notions à renforcer", async () => {
    seed();
    write(`plugstudy:demo:col:users/${UID}/attempts`, [attempt("t1", 3, ["piles", "boucle", "variables"])]);
    write(
      `plugstudy:demo:col:users/${UID}/courses/c1/notions`,
      notions.map((n) => ({ ...n, mastery: n.id === "piles" ? 0.5 : 1 }))
    );
    window.history.pushState({}, "", "/?onglet=quiz");
    wrap(<CoursDetailPage />);
    expect(await screen.findByText("Quiz fait")).toBeTruthy();
    expect(await screen.findByText("75 %")).toBeTruthy();
    expect(screen.getByText("Moyenne")).toBeTruthy();
    expect(await screen.findByText("3/4")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Quiz de fin de séance/ }).getAttribute("href")).toBe("/cours/c1/resultat?tentative=t1");
    expect(await screen.findByText("À renforcer")).toBeTruthy();
    expect(await screen.findByText("Piles et files")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Lancer un quiz" }).getAttribute("href")).toBe("/cours/c1/quiz");
  });

  it("invite à faire un premier quiz", async () => {
    seed();
    window.history.pushState({}, "", "/?onglet=quiz");
    wrap(<CoursDetailPage />);
    expect(await screen.findByText(/Tu n’as pas encore fait de quiz/)).toBeTruthy();
  });
});

describe("Détail du cours : IA (écran 17)", () => {
  it("propose des questions pour démarrer, les conversations récentes et un champ de saisie", async () => {
    seed();
    write(`plugstudy:demo:col:users/${UID}/courses/c1/messages`, [
      { id: "m1", role: "user", text: "C’est quoi une boucle ?", at: Date.now() - 86400000 },
      { id: "m2", role: "assistant", text: "Réponse", at: Date.now() - 86399000 },
    ]);
    window.history.pushState({}, "", "/?onglet=ia");
    const user = userEvent.setup();
    wrap(<CoursDetailPage />);
    expect(await screen.findByText("Pour démarrer")).toBeTruthy();
    expect(screen.getByText("Pose-moi une question sur Algorithmique. Je réponds uniquement avec ton cours.")).toBeTruthy();
    const starter = screen.getByRole("link", { name: "Explique-moi « Récursivité »" });
    expect(starter.getAttribute("href")).toBe(`/cours/c1/assistant?q=${encodeURIComponent("Explique-moi « Récursivité »")}`);
    expect(screen.getByText("Dernières conversations")).toBeTruthy();
    expect(screen.getByText("Hier")).toBeTruthy();

    await user.type(screen.getByLabelText("Ta question"), "C’est quoi un tableau ?");
    await user.click(screen.getByRole("button", { name: "Ouvrir la conversation" }));
    expect(router.push).toHaveBeenCalledWith(`/cours/c1/assistant?q=${encodeURIComponent("C’est quoi un tableau ?")}`);
  });
});

describe("Cours introuvable", () => {
  it("le dit clairement", async () => {
    seed();
    write(`plugstudy:demo:courses:${UID}`, []);
    wrap(<CoursDetailPage />);
    expect(await screen.findByText("Ce cours n’existe pas ou a été supprimé.")).toBeTruthy();
  });
});

describe("Assistant : question venue du détail du cours", () => {
  it("envoie la question une seule fois et répond avec le cours", async () => {
    seed();
    window.history.pushState({}, "", `/?q=${encodeURIComponent("C’est quoi une boucle ?")}`);
    wrap(<AssistantPage />);
    expect(await screen.findByText("Algorithmique, chap. 2, p. 8")).toBeTruthy();
    await waitFor(() => expect(read(`plugstudy:demo:col:users/${UID}/courses/c1/messages`)).toHaveLength(2));
  });
});
