import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { router } from "./setup";
import { AuthProvider } from "@/lib/auth-context";
import { backend, UserFacingError } from "@/lib/backend";
import { askAssistant, sendCourseFile } from "@/lib/api";
import AjouterCoursPage from "@/app/cours/ajouter/page";
import AssistantPage from "@/app/cours/[id]/assistant/page";
import CoursDetailPage from "@/app/cours/[id]/page";
import CoursPage from "@/app/cours/page";
import { buildSampleContent } from "@/lib/sample-content";
import { errorMessage } from "@/lib/detail";
import type { Course } from "@/lib/types";

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
const write = (key: string, value: unknown) => window.localStorage.setItem(key, JSON.stringify(value));
const read = (key: string) => JSON.parse(window.localStorage.getItem(key) ?? "null");
const file = new File(["contenu"], "structures_de_donnees.pdf", { type: "application/pdf" });

const course = (over: Partial<Course> = {}): Course => ({
  id: "c1",
  name: "Algorithmique",
  description: "",
  category: "Informatique",
  fileName: "algo.pdf",
  fileSize: 1000,
  status: "preparing",
  progress: 0,
  examDate: null,
  createdAt: Date.now() - 1000,
  lastStudiedAt: null,
  ...over,
});

function seed(courses: Course[] = [course()]) {
  write("plugstudy:demo:user", { uid: UID, email: "honorat@gmail.com", displayName: "Honorat Dossou" });
  write(`plugstudy:demo:profile:${UID}`, { niveau: "Licence 1", filiere: "Informatique", universite: "UAC", langue: "fr" });
  write(`plugstudy:demo:courses:${UID}`, courses);
}

function ok(body: unknown = {}, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api.test/";
  vi.spyOn(backend, "getIdToken").mockResolvedValue("jeton");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  window.history.pushState({}, "", "/");
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_API_URL;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Appels au backend", () => {
  it("envoie le fichier avec le jeton de l'étudiant", async () => {
    fetchMock.mockResolvedValue(ok({ status: "processing" }, 202));
    expect(await sendCourseFile("c1", file)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/courses/c1/process");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer jeton" });
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("n'envoie rien sans backend branché ou sans session", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(await sendCourseFile("c1", file)).toBe(false);
    process.env.NEXT_PUBLIC_API_URL = "http://api.test";
    vi.spyOn(backend, "getIdToken").mockResolvedValue(null);
    expect(await sendCourseFile("c1", file)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("montre le message du serveur en cas de refus", async () => {
    fetchMock.mockResolvedValue(ok({ detail: "Format non pris en charge. Choisis un PDF, DOCX, PPTX ou TXT." }, 415));
    await expect(sendCourseFile("c1", file)).rejects.toThrow("Format non pris en charge");
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => Promise.reject(new Error("pas du json")) } as unknown as Response);
    await expect(sendCourseFile("c1", file)).rejects.toBeInstanceOf(UserFacingError);
  });

  it("accepte « déjà en préparation » (409) et signale un réseau coupé", async () => {
    fetchMock.mockResolvedValue(ok({ detail: "Ce cours est déjà en préparation." }, 409));
    expect(await sendCourseFile("c1", file)).toBe(true);
    fetchMock.mockRejectedValue(new TypeError("réseau"));
    await expect(sendCourseFile("c1", file)).rejects.toThrow("Impossible de joindre le serveur");
  });

  it("interroge l'assistant et renvoie texte et source", async () => {
    fetchMock.mockResolvedValue(ok({ text: "Une boucle répète.", source: "Algorithmique, chap. 2, p. 8" }));
    expect(await askAssistant("c1", "C’est quoi une boucle ?")).toEqual({ text: "Une boucle répète.", source: "Algorithmique, chap. 2, p. 8" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/courses/c1/assistant");
    expect(JSON.parse(init.body)).toEqual({ question: "C’est quoi une boucle ?" });
    fetchMock.mockResolvedValue(ok({ text: "Je ne trouve pas.", source: null }));
    expect(await askAssistant("c1", "Question ?")).toEqual({ text: "Je ne trouve pas." });
    fetchMock.mockResolvedValue(ok({}, 503));
    expect(await askAssistant("c1", "Question ?")).toBeNull();
    fetchMock.mockRejectedValue(new Error("réseau"));
    expect(await askAssistant("c1", "Question ?")).toBeNull();
  });
});

describe("Ajouter un cours avec le backend", () => {
  async function fillAndSubmit() {
    const user = userEvent.setup();
    wrap(<AjouterCoursPage />);
    await user.upload(await screen.findByTestId("fichier"), file);
    await user.click(await screen.findByRole("button", { name: "Créer le cours" }));
  }

  it("envoie le fichier au backend puis ouvre Mes cours", async () => {
    seed([]);
    fetchMock.mockResolvedValue(ok({ status: "processing" }, 202));
    await fillAndSubmit();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/cours?ajoute=1"));
    const [created] = read(`plugstudy:demo:courses:${UID}`);
    expect(fetchMock.mock.calls[0][0]).toBe(`http://api.test/courses/${created.id}/process`);
  });

  it("marque le cours « à refaire » si l'envoi échoue, et ouvre son détail", async () => {
    seed([]);
    fetchMock.mockRejectedValue(new TypeError("réseau"));
    await fillAndSubmit();
    const [created] = read(`plugstudy:demo:courses:${UID}`);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/cours/${created.id}`));
    expect(created).toBeDefined();
    expect(read(`plugstudy:demo:courses:${UID}`)[0]).toMatchObject({ status: "error", errorReason: "upload" });
  });
});

describe("Cours dont la préparation a échoué", () => {
  it("explique la raison et propose un autre fichier", async () => {
    seed([course({ status: "error", errorReason: "unreadable" })]);
    wrap(<CoursDetailPage />);
    expect((await screen.findByRole("alert")).textContent).toContain("Impossible de lire ce fichier");
    expect(screen.getByText("Préparation impossible")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Choisir un autre fichier" }).getAttribute("href")).toBe("/cours/ajouter");
    expect(screen.queryByRole("link", { name: "Quiz" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remplir avec un contenu d’exemple" })).toBeNull();
  });

  it("a un message pour chaque raison", () => {
    for (const reason of ["unreadable", "format", "empty", "ai", "failed", "upload", undefined] as const) {
      const { title, text } = errorMessage(reason);
      expect(title.length).toBeGreaterThan(5);
      expect(text.length).toBeGreaterThan(10);
    }
    expect(errorMessage("unreadable").text).toContain("PDF scanné");
  });

  it("apparaît « À refaire » dans Mes cours", async () => {
    seed([course({ status: "error", errorReason: "format" })]);
    wrap(<CoursPage />);
    expect(await screen.findByText("À refaire")).toBeTruthy();
    expect(screen.getByText("Préparation impossible")).toBeTruthy();
  });
});

describe("Assistant relié au backend", () => {
  function seedReady() {
    const { notions } = buildSampleContent("Algorithmique");
    seed([course({ status: "ready" })]);
    write(`plugstudy:demo:col:users/${UID}/courses/c1/notions`, notions);
  }

  it("affiche la réponse et la source du serveur", async () => {
    seedReady();
    fetchMock.mockResolvedValue(ok({ text: "Réponse du serveur sur les boucles.", source: "Algorithmique, chap. 2, p. 8" }));
    const user = userEvent.setup();
    wrap(<AssistantPage />);
    await user.type(await screen.findByLabelText("Ta question"), "C’est quoi une boucle ?");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(await screen.findByText("Réponse du serveur sur les boucles.")).toBeTruthy();
    expect(screen.getByText("Algorithmique, chap. 2, p. 8")).toBeTruthy();
  });

  it("retombe sur la recherche dans les notions si le serveur ne répond pas", async () => {
    seedReady();
    fetchMock.mockRejectedValue(new Error("réseau"));
    const user = userEvent.setup();
    wrap(<AssistantPage />);
    await user.type(await screen.findByLabelText("Ta question"), "C’est quoi une boucle ?");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(await screen.findByText(/tant qu’une condition est vraie/)).toBeTruthy();
  });
});
