import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import manifest from "@/app/manifest";

describe("PWA", () => {
  const m = manifest();

  it("est installable : nom, démarrage, mode autonome et couleurs", () => {
    expect(m.name).toBe("PlugStudy");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.theme_color).toBe("#03833d");
  });

  it("déclare des icônes 192, 512 et maskable qui existent", () => {
    const sizes = (m.icons ?? []).map((icon) => `${icon.sizes}:${icon.purpose}`);
    expect(sizes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "512x512:maskable"]));
    for (const icon of m.icons ?? []) {
      expect(existsSync(join(process.cwd(), "public", icon.src))).toBe(true);
    }
  });

  it("a un service worker qui précharge la page hors-ligne", () => {
    const sw = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
    expect(sw).toContain("/offline.html");
    expect(existsSync(join(process.cwd(), "public", "offline.html"))).toBe(true);
  });
});
