import { describe, expect, it } from "vitest";
import { STALLED_AFTER_MS, markStalled } from "@/lib/use-courses";
import type { Course } from "@/lib/types";

const NOW = 1_800_000_000_000;

function course(fields: Partial<Course>): Course {
  return { id: "c1", name: "Cours", status: "preparing", progress: 0, createdAt: NOW, ...fields } as Course;
}

describe("cours bloqués en préparation", () => {
  it("laisse en préparation un cours récent", () => {
    const [result] = markStalled([course({ createdAt: NOW - 2 * 60 * 1000 })], NOW);
    expect(result.status).toBe("preparing");
  });

  it("passe en échec un cours en préparation depuis trop longtemps", () => {
    const [result] = markStalled([course({ createdAt: NOW - STALLED_AFTER_MS - 1 })], NOW);
    expect(result.status).toBe("error");
    expect(result.errorReason).toBe("stalled");
  });

  it("ne touche pas un cours prêt, même ancien", () => {
    const [result] = markStalled([course({ status: "ready", createdAt: NOW - 10 * STALLED_AFTER_MS })], NOW);
    expect(result.status).toBe("ready");
  });
});
