"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { translate, type Lang, type Vars } from "./translate";

export { localeOf, translate, type Lang, type Vars } from "./translate";

export const LANG_STORAGE_KEY = "plugstudy:lang";

interface I18nValue {
  lang: Lang;
  t: (text: string, vars?: Vars) => string;
  /** Change la langue tout de suite (aperçu pendant l'onboarding) et s'en souvient sur cet appareil. */
  setLang: (lang: Lang) => void;
}

// Sans fournisseur (tests, composants isolés) : français.
const I18nContext = createContext<I18nValue>({ lang: "fr", t: (text, vars) => translate(text, "fr", vars), setLang: () => {} });

function readStored(): Lang | null {
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    return stored === "en" || stored === "fr" ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Langue de l'interface : celle du profil de l'étudiant quand il est connecté ; sinon celle qu'il a choisie sur cet
 * appareil (onboarding), sinon le français.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [lang, setLangState] = useState<Lang>("fr");

  // Après l'hydratation : la langue gardée sur cet appareil (évite un écart entre le serveur et le navigateur).
  useEffect(() => {
    const stored = readStored();
    if (stored) setLangState(stored);
  }, []);

  // Le profil fait foi dès qu'il est connu.
  useEffect(() => {
    if (profile?.langue) setLangState(profile.langue);
  }, [profile?.langue]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // Sans stockage, la langue reste valable jusqu'au rechargement.
    }
  }, []);

  const t = useCallback((text: string, vars?: Vars) => translate(text, lang, vars), [lang]);
  const value = useMemo<I18nValue>(() => ({ lang, t, setLang }), [lang, t, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
