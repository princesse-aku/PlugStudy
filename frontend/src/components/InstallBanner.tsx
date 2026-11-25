"use client";

import { useEffect, useState } from "react";
import { Button } from "./Button";

const DISMISSED_KEY = "plugstudy:install-dismissed";

/** Événement non standard envoyé par Chrome et Edge quand l'application peut être installée. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isInstalled() {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function wasDismissed() {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Bandeau « Installe PlugStudy » (fermable). Il n'apparaît que si l'installation est possible :
 * - Chrome / Edge : bouton « Installer » qui ouvre la fenêtre d'installation du navigateur ;
 * - iPhone et iPad : pas de bouton possible, on explique le geste (Partager > Sur l'écran d'accueil).
 * Il disparaît une fois l'application installée ou après « Plus tard ».
 */
export function InstallBanner() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isInstalled() || wasDismissed()) return;
    setHidden(false);
    setIos(isIos());

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setPrompt(null);
      setHidden(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setHidden(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Sans stockage, le bandeau reviendra à la prochaine visite : sans gravité.
    }
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    if (outcome === "accepted") setHidden(true);
  }

  if (hidden || (!prompt && !ios)) return null;

  return (
    <section
      aria-label="Installer l’application"
      className="flex flex-col gap-3 rounded-[14px] border border-line bg-card px-4 py-3.5"
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-base font-bold leading-snug">Installe PlugStudy</h2>
        <p className="text-sm leading-relaxed text-muted">
          {prompt
            ? "Ouvre l’application comme une app, directement depuis ton écran d’accueil."
            : "Touche le bouton Partager, puis « Sur l’écran d’accueil » pour ouvrir PlugStudy comme une app."}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {prompt ? (
          <div className="flex-1">
            <Button type="button" onClick={() => void install()}>
              Installer
            </Button>
          </div>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          className="flex min-h-11 items-center justify-center px-4 text-sm font-semibold text-deep"
        >
          Plus tard
        </button>
      </div>
    </section>
  );
}
