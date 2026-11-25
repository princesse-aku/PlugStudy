import type { ReactNode } from "react";

/**
 * Cadre d'un écran, sur téléphone comme sur ordinateur.
 * - Téléphone : l'écran occupe toute la largeur (colonne de 430 px au plus).
 * - Tablette et ordinateur (à partir de 768 px) : l'écran devient une carte centrée de 480 px
 *   sur le fond de page.
 * « white » = fond blanc (animation, connexion) ; « page » = fond vert très clair.
 * `app` = écran à hauteur fixe (zone qui défile + barre du bas), utilisé dans l'application.
 */
export function Screen({
  tone = "page",
  className = "",
  app = false,
  children,
}: {
  tone?: "white" | "page";
  className?: string;
  app?: boolean;
  children?: ReactNode;
}) {
  const background = tone === "white" ? "bg-screen" : "bg-page";
  const height = app
    ? "relative h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-hidden md:h-[min(844px,calc(100dvh-4rem))]"
    : "min-h-dvh";
  return (
    <main className={`min-h-dvh w-full ${background} md:flex md:items-center md:justify-center md:bg-page md:p-8`}>
      <div
        className={`mx-auto flex ${height} w-full max-w-[430px] flex-col ${background} md:min-h-[640px] md:max-w-[480px] md:overflow-hidden md:rounded-3xl md:border md:border-line md:bg-card md:shadow-sm ${className}`}
      >
        {children}
      </div>
    </main>
  );
}
