import { describe, expect, it } from "vitest";
import { toCourse } from "@/lib/backend/firebase";

/** Un faux document Firestore : seulement ce que `toCourse` lit. */
const snapshot = (id: string, data: Record<string, unknown>) =>
  ({ id, data: () => data }) as unknown as Parameters<typeof toCourse>[0];

describe("Lecture d'un cours depuis Firestore", () => {
  const base = { name: "Algorithmique", category: "Informatique", status: "ready", progress: 40, createdAt: 1000 };

  it("garde tous les champs que l'application écrit sur le cours", () => {
    const course = toCourse(
      snapshot("c1", {
        ...base,
        description: "d",
        fileName: "a.pdf",
        fileSize: 12,
        examDate: "2026-12-12",
        studyMinutes: 60,
        lastStudiedAt: 2000,
        summary: "Résumé",
        prepStep: 4,
        status: "error",
        errorReason: "format",
        dismissed: true,
      })
    );
    expect(course).toMatchObject({
      id: "c1",
      name: "Algorithmique",
      examDate: "2026-12-12",
      studyMinutes: 60,
      summary: "Résumé",
      prepStep: 4,
      status: "error",
      errorReason: "format",
      dismissed: true,
    });
  });

  it("l'avis d'échec fermé (dismissed) n'est pas perdu : sans lui, « Fermer » ne ferait rien à l'écran", () => {
    expect(toCourse(snapshot("c1", { ...base, status: "error", dismissed: true })).dismissed).toBe(true);
    expect(toCourse(snapshot("c1", { ...base, status: "error" })).dismissed).toBeUndefined();
    expect(toCourse(snapshot("c1", { ...base, status: "error", dismissed: "oui" })).dismissed).toBeUndefined();
  });

  it("ignore un temps par jour qui n'est pas un nombre", () => {
    expect(toCourse(snapshot("c1", { ...base, studyMinutes: "60" })).studyMinutes).toBeUndefined();
  });
});
