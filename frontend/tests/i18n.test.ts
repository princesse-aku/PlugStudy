import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { EN } from "@/lib/i18n/en";
import { translate } from "@/lib/i18n/translate";

const SRC = join(process.cwd(), "src");

/** Fonctions cachées dans le MVP (voir src/lib/features.ts) : leurs textes ne sont pas encore traduits. */
const SKIP = [
  "app/suivi/page.tsx",
  "app/planning/page.tsx",
  "app/cours/[id]/assistant/page.tsx",
  "app/profil/suppression/page.tsx",
  "components/ComingSoon.tsx",
  "lib/activity.ts",
  "lib/sample-content.ts",
  "lib/i18n/",
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? files(full) : [full];
  });
}

const sources = files(SRC)
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .map((file) => ({ path: relative(SRC, file).replace(/\\/g, "/"), text: readFileSync(file, "utf8") }))
  .filter((file) => !SKIP.some((skip) => file.path.startsWith(skip) || file.path === skip));

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

/** Les textes passés à t(...) et translate(...) sous forme de chaîne littérale. */
function translatedKeys(): { key: string; where: string }[] {
  const found: { key: string; where: string }[] = [];
  for (const { path, text } of sources) {
    for (const match of text.matchAll(/\b(?:t|translate)\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
      const key = match[2].replace(/\\(["'`\\])/g, "$1");
      if (key.includes("${")) continue; // à écrire avec des {variables}
      found.push({ key, where: path });
    }
  }
  return found;
}

describe("Traduction française vers anglaise", () => {
  it("chaque texte passé à t() a sa traduction anglaise", () => {
    const missing = translatedKeys().filter(({ key }) => !(key in EN));
    expect(missing.map((m) => `${m.where} : « ${m.key} »`)).toEqual([]);
  });

  it("les traductions gardent les mêmes {variables}", () => {
    const bad = Object.entries(EN).filter(([fr, en]) => placeholders(fr).join() !== placeholders(en).join());
    expect(bad.map(([fr]) => fr)).toEqual([]);
  });

  it("aucune traduction vide ou identique à l'original sans raison", () => {
    const empty = Object.entries(EN).filter(([, en]) => en.trim() === "");
    expect(empty.map(([fr]) => fr)).toEqual([]);
  });

  it("aucun texte affiché n'est écrit en dur dans le JSX (il doit passer par t())", () => {
    const hardcoded: string[] = [];
    for (const { path, text } of sources.filter((s) => s.path.endsWith(".tsx"))) {
      const lines = text.split("\n");
      lines.forEach((line, index) => {
        const code = line.replace(/\/\/.*$/, "").replace(/\{\/\*.*?\*\/\}/g, "");
        if (/^\s*(\*|\/\*)/.test(line)) return; // commentaire
        // Texte entre deux balises : >Se connecter<
        for (const m of code.matchAll(/>([^<>{}=;()]*[A-Za-zÀ-ÿ][^<>{}=;()]*)</g)) {
          if (m[1].trim().length > 0) hardcoded.push(`${path}:${index + 1} texte « ${m[1].trim()} »`);
        }
        // Attributs affichés ou lus par les lecteurs d'écran
        for (const m of code.matchAll(/\b(aria-label|placeholder|title|alt)="([^"{]+)"/g)) {
          hardcoded.push(`${path}:${index + 1} ${m[1]}="${m[2]}"`);
        }
      });
      // Texte sur sa propre ligne dans le JSX (retour à la ligne après une balise)
      const jsxBlocks = text.matchAll(/>\s*\n\s*([A-ZÀ-Ý][^<>{}\n]*[a-zà-ÿ.!?:…’'])\s*\n\s*</g);
      for (const m of jsxBlocks) hardcoded.push(`${path} texte multi-lignes « ${m[1].trim()} »`);
    }
    expect(hardcoded).toEqual([]);
  });

  it("translate() traduit, remplace les variables et retombe sur le français", () => {
    expect(translate("à l’instant", "en")).toBe("just now");
    expect(translate("il y a {n} h", "en", { n: 3 })).toBe("3 h ago");
    expect(translate("il y a {n} h", "fr", { n: 3 })).toBe("il y a 3 h");
    expect(translate("Un texte jamais traduit", "en")).toBe("Un texte jamais traduit");
  });
});
