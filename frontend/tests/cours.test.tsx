import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { router } from "./setup";
import { AuthProvider } from "@/lib/auth-context";
import AccueilPage from "@/app/accueil/page";
import CoursPage from "@/app/cours/page";
import AjouterCoursPage from "@/app/cours/ajouter/page";
import { averageProgress, countCourses, filterCourses, nameFromFile } from "@/lib/courses";
import { fileSizeLabel, relativeTime, shortDate } from "@/lib/time";
import type { Course } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const wrap = (page: React.ReactNode) => render(<AuthProvider>{page}</AuthProvider>);

const course = (over: Partial<Course>): Course => ({
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
  lastStudiedAt: Date.now() - 3600000,
  ...over,
});

function seed(courses: Course[] = []) {
  window.localStorage.setItem(
    "plugstudy:demo:user",
    JSON.stringify({ uid: "demo-honorat", email: "honorat@exemple.com", displayName: "Honorat Dossou" })
  );
  window.localStorage.setItem(
    "plugstudy:demo:profile:demo-honorat",
    JSON.stringify({ niveau: "Licence 1", filiere: "Informatique", universite: "UAC", langue: "fr" })
  );
  window.localStorage.setItem("plugstudy:demo:courses:demo-honorat", JSON.stringify(courses));
}

describe("Règles de calcul des cours", () => {
  const list = [course({ id: "a", progress: 72 }), course({ id: "b", progress: 100 }), course({ id: "c", progress: 0 })];

  it("compte les cours en cours et terminés", () => {
    expect(countCourses(list)).toEqual({ all: 3, done: 1, inProgress: 2 });
    expect(filterCourses(list, "termines").map((c) => c.id)).toEqual(["b"]);
    expect(filterCourses(list, "en-cours").map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("calcule la progression globale", () => {
    expect(averageProgress(list)).toBe(57);
    expect(averageProgress([])).toBe(0);
  });

  it("propose un nom d'après le fichier", () => {
    expect(nameFromFile("structures_de_donnees.pdf")).toBe("Structures de donnees");
  });

  it("formate dates, durées et tailles", () => {
    expect(shortDate("2026-12-12")).toBe("12 déc.");
    const now = Date.now();
    expect(relativeTime(now - 2 * 3600000, now)).toBe("il y a 2 h");
    expect(relativeTime(now - 30 * 3600000, now)).toBe("hier");
    expect(relativeTime(now - 3 * 86400000, now)).toBe("il y a 3 jours");
    expect(fileSizeLabel(2.5 * 1024 * 1024)).toBe("2,5 Mo");
  });
});

describe("Accueil", () => {
  it("affiche les compteurs et l'activité récente", async () => {
    seed([course({ id: "a", name: "Algorithmique" }), course({ id: "b", name: "Réseaux", progress: 100 })]);
    wrap(<AccueilPage />);
    expect(await screen.findByText("Voici où tu en es.")).toBeTruthy();
    // Le premier « Cours » de la page est le libellé du compteur (le second est dans la barre du bas).
    await waitFor(() => expect(screen.getAllByText("Cours")[0].previousSibling?.textContent).toBe("2"));
    expect(await screen.findByText("Activité récente")).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText("Nouveau cours ajouté")).toHaveLength(2));
    expect(screen.getByRole("link", { name: "Ajouter un cours" }).getAttribute("href")).toBe("/cours/ajouter");
  });
});

describe("Mes cours", () => {
  it("liste les cours et filtre En cours / Terminés", async () => {
    seed([course({ id: "a", name: "Algorithmique" }), course({ id: "b", name: "Comptabilité", progress: 100 })]);
    const user = userEvent.setup();
    wrap(<CoursPage />);
    expect(await screen.findByText("2 cours · 1 terminé")).toBeTruthy();
    expect(screen.getByText("Examen : 12 déc.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Terminés 1" }));
    expect(screen.getByRole("button", { name: "Terminés 1" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("Algorithmique")).toBeNull();
    expect(screen.getByText("Comptabilité")).toBeTruthy();
    expect(screen.getByText("Tout révisé")).toBeTruthy();
  });

  it("invite à ajouter un cours quand la liste est vide", async () => {
    seed([]);
    wrap(<CoursPage />);
    expect(await screen.findByText(/Tu n’as pas encore de cours/)).toBeTruthy();
  });

  it("marque la navigation courante", async () => {
    seed([]);
    wrap(<CoursPage />);
    const nav = await screen.findByRole("navigation", { name: "Navigation principale" });
    expect(within(nav).getByRole("link", { name: /Cours/ }).getAttribute("aria-current")).toBe("page");
  });
});

describe("Ajouter un cours", () => {
  const pdf = new File(["contenu"], "structures_de_donnees.pdf", { type: "application/pdf" });

  it("garde « Créer le cours » inactif tant qu'aucun fichier n'est choisi", async () => {
    seed();
    wrap(<AjouterCoursPage />);
    const create = await screen.findByRole("button", { name: "Créer le cours" });
    expect(create.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Dépose ton fichier de cours")).toBeTruthy();
  });

  it("refuse un format non pris en charge", async () => {
    seed();
    const user = userEvent.setup({ applyAccept: false });
    wrap(<AjouterCoursPage />);
    await user.upload(await screen.findByTestId("fichier"), new File(["x"], "photo.png", { type: "image/png" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Ce format n’est pas pris en charge");
  });

  it("propose le nom et la catégorie, puis crée le cours", async () => {
    seed();
    const user = userEvent.setup();
    wrap(<AjouterCoursPage />);
    await user.upload(await screen.findByTestId("fichier"), pdf);
    expect(((await screen.findByLabelText("Nom du cours")) as HTMLInputElement).value).toBe("Structures de donnees");
    expect((screen.getByLabelText("Catégorie") as HTMLSelectElement).value).toBe("Informatique");
    expect(screen.getByText("structures_de_donnees.pdf")).toBeTruthy();

    await user.clear(screen.getByLabelText("Nom du cours"));
    await user.type(screen.getByLabelText("Nom du cours"), "Structures de données");
    await user.click(screen.getByRole("button", { name: "Créer le cours" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/cours?ajoute=1"));
    const saved = JSON.parse(window.localStorage.getItem("plugstudy:demo:courses:demo-honorat") ?? "[]");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ name: "Structures de données", status: "preparing", progress: 0, category: "Informatique" });
  });
});
