import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { router } from "./setup";
import { AuthProvider } from "@/lib/auth-context";
import { features } from "@/lib/features";
import AccueilPage from "@/app/accueil/page";
import AssistantPage from "@/app/cours/[id]/assistant/page";
import CoursDetailPage from "@/app/cours/[id]/page";
import CoursPage from "@/app/cours/page";
import PreparationPage from "@/app/preparation/page";
import ProfilPage from "@/app/profil/page";
import ResultatPage from "@/app/cours/[id]/resultat/page";
import SeancePage from "@/app/cours/[id]/seance/page";
import SuiviPage from "@/app/suivi/page";
import { buildSampleContent, SAMPLE_SUMMARY } from "@/lib/sample-content";

// Ces tests utilisent les vrais réglages du MVP (src/lib/features.ts), sans les rallumer.
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/",
  useParams: () => ({ id: "c1" }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const UID = "demo-honorat";
const wrap = (page: React.ReactNode) => render(<AuthProvider>{page}</AuthProvider>);
const write = (key: string, value: unknown) => window.localStorage.setItem(key, JSON.stringify(value));
const { notions, questions } = buildSampleContent("Algorithmique");

function seed(opts: { courses?: boolean } = {}) {
  write("plugstudy:demo:user", { uid: UID, email: "honorat@gmail.com", displayName: "Honorat Dossou" });
  write(`plugstudy:demo:profile:${UID}`, { niveau: "Licence 1", filiere: "Informatique", universite: "UAC", langue: "fr" });
  if (opts.courses === false) return;
  write(`plugstudy:demo:courses:${UID}`, [
    {
      id: "c1", name: "Algorithmique", description: "", category: "Informatique", fileName: "a.pdf", fileSize: 1000,
      status: "ready", progress: 40, examDate: null, createdAt: Date.now() - 86400000, lastStudiedAt: null,
      summary: SAMPLE_SUMMARY, prepStep: 4,
    },
  ]);
  write(`plugstudy:demo:col:users/${UID}/courses/c1/notions`, notions);
  write(`plugstudy:demo:col:users/${UID}/courses/c1/questions`, questions);
}

beforeEach(() => window.history.pushState({}, "", "/"));

describe("Réglages du MVP", () => {
  it("ne cache que ce qui n'est pas encore dans le produit (le Planning est maintenant visible)", () => {
    expect(features).toEqual({
      assistant: false,
      suivi: false,
      planning: true,
      profilePhoto: false,
      deleteAccount: false,
      strictValidation: false,
      typicalCourses: false,
    });
  });
});

describe("Démarrage sans aucun cours", () => {
  it("l'étudiant arrive sur un accueil vide qui l'invite à ajouter son premier cours", async () => {
    seed({ courses: false });
    wrap(<AccueilPage />);
    expect(await screen.findByText("Ajoute ton premier cours")).toBeTruthy();
    expect(screen.getByText("Commençons par ton premier cours.")).toBeTruthy();
  });

  it("Mes cours est vide et ne propose aucun cours à l'avance", async () => {
    seed({ courses: false });
    wrap(<CoursPage />);
    expect(await screen.findByText(/Tu n’as pas encore de cours/)).toBeTruthy();
    expect(screen.getByText("0 cours · 0 terminé")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Algorithmique/ })).toBeNull();
  });

  it("la préparation de l'espace ne crée aucun cours et ne parle pas de cours types", async () => {
    seed({ courses: false });
    wrap(<PreparationPage />);
    expect(await screen.findByText("Préparation de ton espace")).toBeTruthy();
    expect(screen.getByText(/Ton espace est vide pour l’instant/)).toBeTruthy();
    expect(screen.queryByText(/cours types/i)).toBeNull();
    await screen.findByRole("link", { name: "Aller à l’accueil" }, { timeout: 4000 });
    expect(window.localStorage.getItem(`plugstudy:demo:courses:${UID}`)).toBeNull();
  });
});

describe("Navigation du MVP", () => {
  it("la barre du bas montre Accueil, Cours, Planning et Profil", async () => {
    seed();
    wrap(<CoursPage />);
    const nav = await screen.findByRole("navigation", { name: "Navigation principale" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual(["Accueil", "Cours", "Planning", "Profil"]);
  });

  it("le détail du cours n'a que les onglets Fiche et Quiz", async () => {
    seed();
    wrap(<CoursDetailPage />);
    const tabs = await screen.findByRole("navigation", { name: "Sections du cours" });
    expect(within(tabs).getAllByRole("link").map((link) => link.textContent)).toEqual(["Fiche", "Quiz"]);
  });

  it("une adresse ?onglet=ia retombe sur la fiche", async () => {
    seed();
    window.history.pushState({}, "", "/?onglet=ia");
    wrap(<CoursDetailPage />);
    expect(await screen.findByText("Résumé du cours")).toBeTruthy();
    expect(screen.queryByText("Pour démarrer")).toBeNull();
  });

  it("la séance n'a pas de « Poser une question »", async () => {
    seed();
    wrap(<SeancePage />);
    expect(await screen.findByText("Notion 1 sur 4")).toBeTruthy();
    expect(screen.queryByText("Poser une question")).toBeNull();
    expect(screen.getByRole("button", { name: "Passer au quiz" })).toBeTruthy();
  });

  it("le résultat du quiz ne parle pas du Suivi", async () => {
    seed();
    write(`plugstudy:demo:col:users/${UID}/attempts`, [
      { id: "t1", courseId: "c1", courseName: "Algorithmique", at: Date.now(), score: 3, total: 4, answers: [] },
    ]);
    window.history.pushState({}, "", "/?tentative=t1");
    wrap(<ResultatPage />);
    expect(await screen.findByText("Bien joué !")).toBeTruthy();
    expect(screen.queryByText(/Suivi/)).toBeNull();
  });

  it("le profil n'a ni « Changer la photo » ni « Supprimer mon compte »", async () => {
    seed();
    wrap(<ProfilPage />);
    expect(await screen.findByRole("button", { name: "Se déconnecter" })).toBeTruthy();
    expect(screen.getByLabelText("Nom complet")).toBeTruthy();
    expect(screen.queryByText("Changer la photo")).toBeNull();
    expect(screen.queryByText("Supprimer mon compte")).toBeNull();
  });
});

describe("Pages cachées : adresse tapée à la main", () => {
  it("le Suivi renvoie à l'accueil", async () => {
    seed();
    wrap(<SuiviPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/accueil"));
    expect(screen.queryByText("Progression globale")).toBeNull();
  });

  it("l'assistant renvoie au détail du cours", async () => {
    seed();
    wrap(<AssistantPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/cours/c1"));
    expect(screen.queryByLabelText("Ta question")).toBeNull();
  });
});
