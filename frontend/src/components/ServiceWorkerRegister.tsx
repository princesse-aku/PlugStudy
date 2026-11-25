"use client";

import { useEffect } from "react";

/** Enregistre le service worker (production seulement : en développement il gênerait le rechargement à chaud). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sans service worker l'application fonctionne, simplement sans mode hors connexion.
    });
  }, []);
  return null;
}
