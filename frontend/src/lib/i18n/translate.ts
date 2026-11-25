import { EN } from "./en";

/**
 * Traduction : la clé est le texte FRANÇAIS lui-même (comme gettext). Le français est la langue de référence :
 * `t("Se connecter")` renvoie « Se connecter » en français et « Sign in » en anglais (dictionnaire `en.ts`).
 * Un texte absent du dictionnaire s'affiche en français : rien ne casse, et `tests/i18n.test.ts` vérifie que
 * chaque texte passé à `t()` est bien traduit.
 *
 * Variables : `t("Notion {n} sur {total}", { n: 2, total: 7 })`. Les mêmes `{variables}` doivent figurer dans la
 * traduction. Pour un pluriel, on écrit deux textes (un pour 1, un pour plusieurs).
 */
export type Lang = "fr" | "en";
export type Vars = Record<string, string | number>;

function fill(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** Traduit un texte français dans la langue demandée (utilisable hors composant, par exemple dans `lib/`). */
export function translate(text: string, lang: Lang, vars?: Vars): string {
  return fill(lang === "en" ? (EN[text] ?? text) : text, vars);
}

/** Lieu pour les dates et les nombres (`Intl`). */
export const localeOf = (lang: Lang) => (lang === "en" ? "en-GB" : "fr-FR");
