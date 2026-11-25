import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { router } from "./setup";
import { AuthProvider } from "@/lib/auth-context";
import ConnexionPage from "@/app/connexion/page";
import OnboardingPage from "@/app/onboarding/page";
import PreparationPage from "@/app/preparation/page";
import AccueilPage from "@/app/accueil/page";
import ProfilPage from "@/app/profil/page";

// Mode démo : Firebase n'est pas configuré dans les tests (NODE_ENV = test).
const wrap = (page: React.ReactNode) => render(<AuthProvider>{page}</AuthProvider>);

function seedStudent(withProfile: boolean) {
  window.localStorage.setItem(
    "plugstudy:demo:user",
    JSON.stringify({ uid: "demo-honorat", email: "honorat@exemple.com", displayName: null })
  );
  if (withProfile) {
    window.localStorage.setItem(
      "plugstudy:demo:profile:demo-honorat",
      JSON.stringify({ niveau: "Licence 1", filiere: "Informatique", universite: "UAC", langue: "fr" })
    );
  }
}

describe("Connexion", () => {
  it("envoie un nouvel étudiant vers l'onboarding après la connexion", async () => {
    const user = userEvent.setup();
    wrap(<ConnexionPage />);
    await user.type(await screen.findByLabelText("Adresse e-mail"), "honorat@exemple.com");
    await user.type(screen.getByLabelText("Mot de passe"), "motdepasse");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/onboarding"));
  });

  it("refuse un formulaire vide avec un message clair", async () => {
    const user = userEvent.setup();
    wrap(<ConnexionPage />);
    await user.click(await screen.findByRole("button", { name: "Se connecter" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Écris ton adresse e-mail");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("envoie un étudiant qui revient directement à l'accueil", async () => {
    seedStudent(true);
    wrap(<ConnexionPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/accueil"));
  });

  it("permet d'afficher le mot de passe", async () => {
    const user = userEvent.setup();
    wrap(<ConnexionPage />);
    const field = await screen.findByLabelText("Mot de passe");
    expect(field.getAttribute("type")).toBe("password");
    await user.click(screen.getByRole("button", { name: "Afficher le mot de passe" }));
    expect(field.getAttribute("type")).toBe("text");
  });
});

describe("Onboarding", () => {
  it("renvoie vers la connexion si personne n'est connecté", async () => {
    wrap(<OnboardingPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/connexion"));
  });

  it("demande la filière et l'université avant de continuer", async () => {
    seedStudent(false);
    const user = userEvent.setup();
    wrap(<OnboardingPage />);
    await user.click(await screen.findByRole("button", { name: "Continuer" }));
    expect(await screen.findByText("Écris ta filière.")).toBeTruthy();
    expect(screen.getByText("Écris ton université ou ton école.")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("enregistre le profil puis ouvre la préparation", async () => {
    seedStudent(false);
    const user = userEvent.setup();
    wrap(<OnboardingPage />);
    await user.selectOptions(await screen.findByLabelText("Niveau d’étude"), "Master 1");
    await user.type(screen.getByLabelText("Filière"), "  Droit ");
    await user.type(screen.getByLabelText("Université ou école"), "UAC");
    await user.click(screen.getByRole("button", { name: "English" }));
    await user.click(screen.getByRole("button", { name: "Continuer" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/preparation"));
    expect(JSON.parse(window.localStorage.getItem("plugstudy:demo:profile:demo-honorat") ?? "null")).toEqual({
      niveau: "Master 1",
      filiere: "Droit",
      universite: "UAC",
      langue: "en",
    });
  });
});

describe("Préparation", () => {
  afterEach(() => vi.useRealTimers());

  it("affiche le profil puis débloque l'accès à l'accueil à la fin des étapes", async () => {
    seedStudent(true);
    wrap(<PreparationPage />);
    expect(await screen.findByText("Licence 1 · Informatique · UAC")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aller à l’accueil" }).hasAttribute("disabled")).toBe(true);
    const link = await screen.findByRole("link", { name: "Aller à l’accueil" }, { timeout: 4000 });
    expect(link.getAttribute("href")).toBe("/accueil");
  });
});

describe("Accueil et profil", () => {
  it("dit bonjour et propose d'ajouter un premier cours quand il n'y en a pas", async () => {
    seedStudent(true);
    wrap(<AccueilPage />);
    expect(await screen.findByText("Bonjour, Honorat")).toBeTruthy();
    expect(screen.getByText("Ajoute ton premier cours")).toBeTruthy();
  });

  it("renvoie vers la connexion si personne n'est connecté", async () => {
    wrap(<AccueilPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/connexion"));
  });

  it("permet de se déconnecter depuis le profil", async () => {
    seedStudent(true);
    const user = userEvent.setup();
    wrap(<ProfilPage />);
    await user.click(await screen.findByRole("button", { name: "Se déconnecter" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/connexion"));
    expect(window.localStorage.getItem("plugstudy:demo:user")).toBeNull();
  });
});
