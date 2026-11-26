import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { router } from "./setup";
import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n";
import PlanningPage from "@/app/planning/page";
import ReglagesPage from "@/app/planning/reglages/page";
import {
  addDays,
  agenda,
  buildPlan,
  buildSessions,
  courseUnits,
  dayMark,
  daysBetween,
  focusPlan,
  monthGrid,
  mondayOf,
  sessionCount,
  sessionCountLabel,
  sessionTitle,
  weekProgress,
  weekTitle,
} from "@/lib/planning";
import type { Plan } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/",
  useParams: () => ({ id: "c1" }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const UID = "demo-honorat";
const read = (key: string) => JSON.parse(window.localStorage.getItem(key) ?? "null");
const write = (key: string, value: unknown) => window.localStorage.setItem(key, JSON.stringify(value));
const wrap = (page: React.ReactNode) =>
  render(
    <AuthProvider>
      <I18nProvider>{page}</I18nProvider>
    </AuthProvider>
  );

const NOTIONS = [
  { id: "n1", title: "Variables", source: "Algorithmique, chap. 1, p. 3", importance: 0.7, frequency: 0.5, position: 1, mastery: 0 },
  { id: "n2", title: "Boucles", source: "Algorithmique, chap. 2, p. 8", importance: 0.7, frequency: 0.5, position: 1, mastery: 0 },
];

const course = (over: Record<string, unknown> = {}) => ({
  id: "c1", name: "Algorithmique", description: "", category: "Informatique", fileName: "a.pdf", fileSize: 1000,
  status: "ready", progress: 0, examDate: null, createdAt: Date.now() - 86400000, lastStudiedAt: null, ...over,
});

function seed(opts: { langue?: string; courses?: unknown[]; plan?: Plan | null } = {}) {
  write("plugstudy:demo:user", { uid: UID, email: "honorat@gmail.com", displayName: "Honorat Dossou" });
  write(`plugstudy:demo:profile:${UID}`, { niveau: "Licence 1", filiere: "Informatique", universite: "UAC", langue: opts.langue ?? "fr" });
  write(`plugstudy:demo:courses:${UID}`, opts.courses ?? [course()]);
  write(`plugstudy:demo:col:users/${UID}/courses/c1/notions`, NOTIONS);
  if (opts.plan) write(`plugstudy:demo:col:users/${UID}/plans`, [opts.plan]);
}

/** Le plan de la maquette : examen le 12 déc., 1 h par jour, départ le 7 déc. ; lundi et mardi sont faits. */
function mockPlan(): Plan {
  const sessions = buildSessions({ unit: "chapter", numbers: [1, 2] }, 60, "2026-12-07", "2026-12-12").map((session, index) => ({
    ...session,
    done: index < 2,
  }));
  return { id: "c1", courseId: "c1", courseName: "Algorithmique", examDate: "2026-12-12", minutes: 60, createdAt: 1, sessions };
}

beforeEach(() => {
  window.history.pushState({}, "", "/");
  vi.useFakeTimers({ toFake: ["Date"] }); // seule l'horloge est simulée : le reste de l'écran tourne normalement
  vi.setSystemTime(new Date(2026, 11, 9, 10, 0)); // mercredi 9 décembre 2026
});
afterEach(() => vi.useRealTimers());

describe("Découpage du planning", () => {
  it("calcule les jours et les semaines", () => {
    expect(daysBetween("2026-12-07", "2026-12-12")).toBe(5);
    expect(daysBetween("2026-12-12", "2026-12-07")).toBe(-5);
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(mondayOf("2026-12-09")).toBe("2026-12-07");
    expect(mondayOf("2026-12-13")).toBe("2026-12-07"); // le dimanche appartient à la semaine qui finit
    expect(weekTitle("2026-12-07", "fr")).toBe("7 – 13 déc. 2026");
    expect(weekTitle("2026-11-30", "fr")).toBe("30 nov. – 6 déc. 2026");
  });

  it("dessine décembre 2026 en cinq semaines, du lundi 30 nov. au dimanche 3 janv.", () => {
    const weeks = monthGrid("2026-12-09");
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toEqual({ iso: "2026-11-30", inMonth: false });
    expect(weeks[0][1]).toEqual({ iso: "2026-12-01", inMonth: true });
    expect(weeks[4][6]).toEqual({ iso: "2027-01-03", inMonth: false });
  });

  it("lit les chapitres dans la source des notions, sinon fait des parties de quatre notions", () => {
    expect(courseUnits([{ source: "Cours, chap. 2, p. 8" }, { source: "Cours, chap. 1, p. 3" }, { source: "Cours, ch. 2, part 1" }])).toEqual({
      unit: "chapter",
      numbers: [1, 2],
    });
    expect(courseUnits([{ source: "Cours, chap. IV, p. 8" }, { source: "Cours, chap. II, p. 3" }]).numbers).toEqual([2, 4]);
    const none = Array.from({ length: 9 }, () => ({ source: "Cours, p. 3" }));
    expect(courseUnits(none)).toEqual({ unit: "part", numbers: [1, 2, 3] });
  });

  it("reproduit la maquette : 5 sessions du 7 au 11 déc. pour un examen le 12", () => {
    const sessions = buildSessions({ unit: "chapter", numbers: [1, 2] }, 60, "2026-12-07", "2026-12-12");
    expect(sessions.map((s) => `${s.date} ${s.kind} ${s.from}`)).toEqual([
      "2026-12-07 chapter 1",
      "2026-12-08 quiz 1",
      "2026-12-09 chapter 2",
      "2026-12-10 quiz 2",
      "2026-12-11 general 0",
    ]);
    expect(sessions.every((s) => s.minutes === 60 && !s.done)).toBe(true);
    expect(sessionCount("2026-12-07", "2026-12-12")).toBe(5);
  });

  it("s'adapte au nombre de jours et finit toujours par la révision générale", () => {
    const kinds = (numbers: number[], days: number) =>
      buildSessions({ unit: "chapter", numbers }, 60, "2026-12-01", addDays("2026-12-01", days)).map((s) => `${s.kind}${s.kind === "general" ? "" : `${s.from}${s.to !== s.from ? `-${s.to}` : ""}`}`);
    // Trop de jours : des révisions de chapitre à tour de rôle avant la révision générale.
    expect(kinds([1, 2], 7)).toEqual(["chapter1", "quiz1", "chapter2", "quiz2", "review1", "review2", "general"]);
    // Juste assez pour les chapitres, avec un quiz après les premiers tant qu'il reste des jours.
    expect(kinds([1, 2, 3], 5)).toEqual(["chapter1", "quiz1", "chapter2", "chapter3", "general"]);
    // Trop peu de jours : des chapitres regroupés.
    expect(kinds([1, 2, 3, 4], 3)).toEqual(["chapter1-2", "chapter3-4", "general"]);
    expect(kinds([1, 2, 3], 2)).toEqual(["chapter1-3", "general"]);
    expect(kinds([1, 2], 1)).toEqual(["general"]);
    // Pas de jour devant soi : pas de planning.
    expect(buildSessions({ unit: "chapter", numbers: [1] }, 60, "2026-12-12", "2026-12-12")).toEqual([]);
    expect(buildSessions({ unit: "chapter", numbers: [1] }, 60, "2026-12-13", "2026-12-12")).toEqual([]);
  });

  it("écrit les sessions en français et en anglais", () => {
    const quiz = { kind: "quiz", unit: "chapter", from: 2, to: 2 } as const;
    expect(sessionTitle({ kind: "chapter", unit: "chapter", from: 1, to: 1 }, "fr")).toBe("Chapitre 1");
    expect(sessionTitle({ kind: "chapter", unit: "chapter", from: 1, to: 3 }, "fr")).toBe("Chapitres 1 à 3");
    expect(sessionTitle({ kind: "chapter", unit: "part", from: 2, to: 2 }, "fr")).toBe("Partie 2");
    expect(sessionTitle(quiz, "fr")).toBe("Quiz 2");
    expect(sessionTitle({ kind: "general", unit: "chapter", from: 0, to: 0 }, "fr")).toBe("Révision générale");
    expect(sessionTitle({ kind: "chapter", unit: "chapter", from: 1, to: 3 }, "en")).toBe("Chapters 1 to 3");
    expect(sessionTitle({ kind: "review", unit: "chapter", from: 2, to: 2 }, "en")).toBe("Review chapter 2");
    expect(sessionCountLabel(5, 60, "fr")).toBe("5 sessions d’1 h");
    expect(sessionCountLabel(5, 30, "fr")).toBe("5 sessions de 30 min");
    expect(sessionCountLabel(1, 120, "fr")).toBe("1 session de 2 h");
    expect(sessionCountLabel(5, 60, "en")).toBe("5 sessions of 1 h");
  });

  it("refait le planning en gardant le passé et les sessions déjà faites", () => {
    const before = mockPlan();
    // Le 9 déc., on repousse l'examen au 14 : lundi 7 et mardi 8 restent faits, la suite est refaite à partir d'aujourd'hui.
    const after = buildPlan({ id: "c1", name: "Algorithmique" }, NOTIONS, { examDate: "2026-12-14", minutes: 60 }, "2026-12-09", before);
    expect(after.sessions.map((s) => s.date)).toEqual(["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10", "2026-12-11", "2026-12-12", "2026-12-13"]);
    expect(after.sessions.slice(0, 2).every((s) => s.done)).toBe(true);
    expect(after.sessions.slice(2).every((s) => !s.done)).toBe(true);
    expect(after.createdAt).toBe(1);
    expect(after.examDate).toBe("2026-12-14");
  });

  it("repère les jours faits, prévus et le plan à présenter", () => {
    const plan = mockPlan();
    const entries = agenda([plan]);
    expect(dayMark(entries, "2026-12-07")).toBe("done");
    expect(dayMark(entries, "2026-12-09")).toBe("planned");
    expect(dayMark(entries, "2026-12-12")).toBeNull();
    expect(weekProgress(entries, ["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10", "2026-12-11"])).toEqual({ done: 2, total: 5 });
    const later = { ...plan, id: "c2", courseId: "c2", courseName: "Droit", examDate: "2027-01-20" };
    expect(focusPlan([later, plan], "2026-12-09")?.courseId).toBe("c1");
    expect(focusPlan([later, plan], "2026-12-13")?.courseId).toBe("c2");
    expect(focusPlan([plan], "2027-03-01")?.courseId).toBe("c1");
    expect(focusPlan([], "2026-12-09")).toBeNull();
  });
});

describe("Planning, réglages (écran 22)", () => {
  const setDate = (value: string) => fireEvent.change(screen.getByLabelText("Date de l’examen"), { target: { value } });

  it("propose le cours, la date et le temps par jour, puis annonce le nombre de sessions", async () => {
    seed();
    wrap(<ReglagesPage />);
    expect(await screen.findByText("Deux réglages, une seule fois.")).toBeTruthy();
    expect(screen.getByLabelText("Pour quel cours ?")).toBeTruthy();
    expect(screen.getByText("Tu l’entres une seule fois. Tu pourras la changer.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "1 h" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Créer mon planning" }).hasAttribute("disabled")).toBe(true);

    setDate("2026-12-14"); // aujourd'hui = mercredi 9 : les 9, 10, 11, 12 et 13 font 5 sessions
    expect(await screen.findByText("5 sessions d’1 h")).toBeTruthy();
    expect(screen.getByText(/jusqu’au 14 déc\./)).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: "30 min" }));
    expect(await screen.findByText("5 sessions de 30 min")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Créer mon planning" }).hasAttribute("disabled")).toBe(false);
  });

  it("refuse une date qui n'est pas après aujourd'hui", async () => {
    seed();
    wrap(<ReglagesPage />);
    await screen.findByLabelText("Date de l’examen");
    setDate("2026-12-09");
    expect(await screen.findByText("La date de l’examen doit être après aujourd’hui.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Créer mon planning" }).hasAttribute("disabled")).toBe(true);
  });

  it("enregistre le planning et la date d'examen du cours, puis retourne au Planning", async () => {
    seed();
    const user = userEvent.setup();
    wrap(<ReglagesPage />);
    await screen.findByLabelText("Date de l’examen");
    setDate("2026-12-14");
    await user.click(screen.getByRole("button", { name: "Créer mon planning" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/planning"));

    const [plan] = read(`plugstudy:demo:col:users/${UID}/plans`);
    expect(plan).toMatchObject({ id: "c1", courseName: "Algorithmique", examDate: "2026-12-14", minutes: 60 });
    expect(plan.sessions.map((s: { date: string; kind: string }) => `${s.date} ${s.kind}`)).toEqual([
      "2026-12-09 chapter",
      "2026-12-10 quiz",
      "2026-12-11 chapter",
      "2026-12-12 quiz",
      "2026-12-13 general",
    ]);
    const [stored] = read(`plugstudy:demo:courses:${UID}`);
    expect(stored).toMatchObject({ examDate: "2026-12-14", studyMinutes: 60 });
  });

  it("reprend les réglages déjà faits pour modifier un planning", async () => {
    seed({ plan: mockPlan() });
    window.history.pushState({}, "", "/?cours=c1");
    wrap(<ReglagesPage />);
    expect((await screen.findByLabelText("Date de l’examen") as HTMLInputElement).value).toBe("2026-12-12");
    expect(screen.getByRole("button", { name: "Mettre à jour mon planning" })).toBeTruthy();
  });

  it("invite à ajouter un cours quand aucun n'est prêt", async () => {
    seed({ courses: [course({ status: "preparing" })] });
    wrap(<ReglagesPage />);
    expect(await screen.findByText(/Ajoute d’abord un cours/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ajouter un cours" }).getAttribute("href")).toBe("/cours/ajouter");
  });
});

describe("Planning, vue Mois (écran 23)", () => {
  it("invite à créer un planning quand il n'y en a pas", async () => {
    seed();
    wrap(<PlanningPage />);
    expect(await screen.findByText(/Tu n’as pas encore de planning/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Créer mon planning" }).getAttribute("href")).toBe("/planning/reglages");
    expect(screen.queryByRole("link", { name: "Modifier" })).toBeNull();
  });

  it("montre le calendrier de décembre et les révisions prévues, avec « Aujourd'hui »", async () => {
    seed({ plan: mockPlan() });
    wrap(<PlanningPage />);
    expect(await screen.findByRole("heading", { name: "Planning" })).toBeTruthy();
    expect(screen.getByText("Algorithmique · examen le 12 déc. · 1 h par jour")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Modifier" }).getAttribute("href")).toBe("/planning/reglages?cours=c1");
    expect(screen.getByRole("heading", { name: "Décembre 2026" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Mois" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Semaine" }).getAttribute("href")).toBe("/planning?vue=semaine");

    const calendar = screen.getByRole("table");
    expect(within(calendar).getByText(/^12/).textContent).toContain("Jour d’examen");
    expect(within(calendar).getByText(/^7/).textContent).toContain("Fait");
    expect(within(calendar).getByText(/^10/).textContent).toContain("Prévu");

    // Lundi et mardi sont faits et passés : seules les révisions à venir sont listées.
    const list = screen.getByRole("heading", { name: "Révisions prévues" }).nextElementSibling as HTMLElement;
    const cards = within(list).getAllByRole("listitem");
    expect(cards).toHaveLength(3);
    expect(within(cards[0]).getByText("Chapitre 2")).toBeTruthy();
    expect(within(cards[0]).getByText("Aujourd’hui")).toBeTruthy();
    expect(within(cards[1]).getByText("Quiz 2")).toBeTruthy();
    expect(within(cards[2]).getByText("Révision générale")).toBeTruthy();
  });

  it("marque une session comme faite, compte le temps de révision et met à jour la liste", async () => {
    seed({ plan: mockPlan() });
    const user = userEvent.setup();
    wrap(<PlanningPage />);
    await user.click(await screen.findByRole("button", { name: "Marquer comme fait : Algorithmique, Chapitre 2" }));

    await waitFor(() => {
      const [plan] = read(`plugstudy:demo:col:users/${UID}/plans`);
      expect(plan.sessions[2].done).toBe(true);
    });
    const [plan] = read(`plugstudy:demo:col:users/${UID}/plans`);
    expect(plan.sessions.filter((s: { done: boolean }) => s.done)).toHaveLength(3);
    const sessions = read(`plugstudy:demo:col:users/${UID}/sessions`);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ courseId: "c1", minutes: 60 });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Marquer comme fait : Algorithmique, Chapitre 2" })).toBeNull());
    const list = screen.getByRole("heading", { name: "Révisions prévues" }).nextElementSibling as HTMLElement;
    expect(within(within(list).getAllByRole("listitem")[0]).getByText("Fait")).toBeTruthy();
  });

  it("change de mois avec les flèches", async () => {
    seed({ plan: mockPlan() });
    const user = userEvent.setup();
    wrap(<PlanningPage />);
    await user.click(await screen.findByRole("button", { name: "Mois suivant" }));
    expect(screen.getByRole("heading", { name: "Janvier 2027" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Mois précédent" }));
    await user.click(screen.getByRole("button", { name: "Mois précédent" }));
    expect(screen.getByRole("heading", { name: "Novembre 2026" })).toBeTruthy();
  });

  it("signale une révision en retard", async () => {
    seed({ plan: mockPlan() });
    vi.setSystemTime(new Date(2026, 11, 10, 10, 0)); // jeudi : celle de mercredi n'a pas été faite
    wrap(<PlanningPage />);
    expect(await screen.findByText("En retard")).toBeTruthy();
    expect(screen.getByText("Aujourd’hui")).toBeTruthy();
  });
});

describe("Planning, vue Semaine (écran 29)", () => {
  it("montre la semaine du 7 au 13 déc. avec 2 sessions faites sur 5", async () => {
    seed({ plan: mockPlan() });
    window.history.pushState({}, "", "/?vue=semaine");
    wrap(<PlanningPage />);
    expect(await screen.findByRole("heading", { name: "7 – 13 déc. 2026" })).toBeTruthy();
    expect(screen.getByText("2 sessions faites sur 5")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Semaine" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Mois" }).getAttribute("href")).toBe("/planning");

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(7);
    expect(within(rows[0]).getByText("Chapitre 1")).toBeTruthy();
    expect(within(rows[0]).getByText("Fait")).toBeTruthy();
    expect(within(rows[1]).getByText("Quiz 1")).toBeTruthy();
    expect(within(rows[2]).getByText("Chapitre 2")).toBeTruthy();
    expect(within(rows[2]).getByText("Aujourd’hui")).toBeTruthy();
    expect(within(rows[2]).getByRole("button", { name: /Marquer comme fait/ })).toBeTruthy();
    expect(within(rows[3]).getByText("Quiz 2")).toBeTruthy();
    expect(within(rows[4]).getByText("Révision générale")).toBeTruthy();
    expect(within(rows[5]).getByText("Algorithmique")).toBeTruthy();
    expect(within(rows[5]).getByText("Examen")).toBeTruthy();
    expect(within(rows[6]).getByText("Pas de session")).toBeTruthy();
    expect(within(rows[6]).getByText("Repos")).toBeTruthy();
  });

  it("marque le quiz de jeudi comme fait depuis le cercle, et change de semaine", async () => {
    seed({ plan: mockPlan() });
    window.history.pushState({}, "", "/?vue=semaine");
    const user = userEvent.setup();
    wrap(<PlanningPage />);
    await user.click(await screen.findByRole("button", { name: "Marquer comme fait : Quiz 2" }));
    await waitFor(() => expect(read(`plugstudy:demo:col:users/${UID}/plans`)[0].sessions[3].done).toBe(true));
    expect(await screen.findByText("3 sessions faites sur 5")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Semaine suivante" }));
    expect(screen.getByRole("heading", { name: "14 – 20 déc. 2026" })).toBeTruthy();
    expect(screen.getByText("Aucune session cette semaine")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Semaine précédente" }));
    expect(screen.getByRole("heading", { name: "7 – 13 déc. 2026" })).toBeTruthy();
  });
});

describe("Planning en anglais", () => {
  it("affiche le calendrier, les révisions et les réglages en anglais", async () => {
    seed({ langue: "en", plan: mockPlan() });
    wrap(<PlanningPage />);
    expect(await screen.findByRole("heading", { name: "December 2026" })).toBeTruthy();
    expect(screen.getByText(/exam on 12 Dec/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Planned reviews" })).toBeTruthy();
    expect(screen.getByText("Chapter 2")).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Edit" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Week" })).toBeTruthy();
  });
});
