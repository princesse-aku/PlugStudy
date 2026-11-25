import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { router } from "./setup";
import { AuthProvider } from "@/lib/auth-context";
import InscriptionPage from "@/app/inscription/page";
import VerificationEmailPage from "@/app/verification-email/page";
import MotDePasseOubliePage from "@/app/mot-de-passe-oublie/page";
import { maskEmail } from "@/lib/email";

// Mode démo : Firebase n'est pas configuré dans les tests.
const wrap = (page: React.ReactNode) => render(<AuthProvider>{page}</AuthProvider>);

function seedUnverified() {
  window.localStorage.setItem(
    "plugstudy:demo:user",
    JSON.stringify({ uid: "demo-abc", email: "abc@gmail.com", displayName: "Honorat Dossou", emailVerified: false })
  );
}

describe("Créer un compte", () => {
  it("signale chaque champ manquant", async () => {
    const user = userEvent.setup();
    wrap(<InscriptionPage />);
    await user.click(await screen.findByRole("button", { name: "Créer mon compte" }));
    expect(await screen.findByText("Écris ton nom complet.")).toBeTruthy();
    expect(screen.getByText("Écris ton adresse e-mail.")).toBeTruthy();
    expect(screen.getByText("Ton mot de passe doit avoir au moins 8 caractères.")).toBeTruthy();
    expect(screen.getByText("Accepte les conditions d’utilisation pour continuer.")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("refuse un mot de passe de moins de 8 caractères", async () => {
    const user = userEvent.setup();
    wrap(<InscriptionPage />);
    await user.type(await screen.findByLabelText("Nom complet"), "Honorat Dossou");
    await user.type(screen.getByLabelText("Adresse e-mail"), "abc@gmail.com");
    await user.type(screen.getByLabelText("Mot de passe"), "court");
    await user.click(screen.getByLabelText("J’accepte les conditions d’utilisation"));
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));
    expect(await screen.findByText("Ton mot de passe doit avoir au moins 8 caractères.")).toBeTruthy();
  });

  it("crée le compte puis envoie vers la vérification de l'e-mail", async () => {
    const user = userEvent.setup();
    wrap(<InscriptionPage />);
    await user.type(await screen.findByLabelText("Nom complet"), "Honorat Dossou");
    await user.type(screen.getByLabelText("Adresse e-mail"), "abc@gmail.com");
    await user.type(screen.getByLabelText("Mot de passe"), "motdepasse");
    await user.click(screen.getByLabelText("J’accepte les conditions d’utilisation"));
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/verification-email"));
  });
});

describe("Vérification de l'e-mail", () => {
  it("masque l'adresse", () => {
    expect(maskEmail("abc@gmail.com")).toBe("a•••@gmail.com");
  });

  it("renvoie vers la connexion si personne n'est connecté", async () => {
    wrap(<VerificationEmailPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/connexion"));
  });

  it("affiche l'adresse masquée et bloque le renvoi pendant le délai", async () => {
    seedUnverified();
    wrap(<VerificationEmailPage />);
    expect(await screen.findByText("a•••@gmail.com")).toBeTruthy();
    const resend = screen.getByRole("button", { name: /Renvoyer le lien dans 1:00/ });
    expect(resend.hasAttribute("disabled")).toBe(true);
  });

  it("passe à l'onboarding après « J'ai ouvert le lien »", async () => {
    seedUnverified();
    const user = userEvent.setup();
    wrap(<VerificationEmailPage />);
    await user.click(await screen.findByRole("button", { name: "J’ai ouvert le lien" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/onboarding"));
  });

  it("permet de changer d'adresse", async () => {
    seedUnverified();
    const user = userEvent.setup();
    wrap(<VerificationEmailPage />);
    await user.click(await screen.findByRole("button", { name: "Changer d’adresse e-mail" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/inscription"));
    expect(window.localStorage.getItem("plugstudy:demo:user")).toBeNull();
  });
});

describe("Mot de passe oublié", () => {
  it("demande une adresse valide", async () => {
    const user = userEvent.setup();
    wrap(<MotDePasseOubliePage />);
    await user.click(await screen.findByRole("button", { name: "Envoyer le lien" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Écris ton adresse e-mail.");
    await user.type(screen.getByLabelText("Adresse e-mail"), "pas-une-adresse");
    await user.click(screen.getByRole("button", { name: "Envoyer le lien" }));
    expect((await screen.findByRole("alert")).textContent).toContain("n’est pas valide");
  });

  it("confirme l'envoi sans révéler si le compte existe", async () => {
    const user = userEvent.setup();
    wrap(<MotDePasseOubliePage />);
    await user.type(await screen.findByLabelText("Adresse e-mail"), "abc@gmail.com");
    await user.click(screen.getByRole("button", { name: "Envoyer le lien" }));
    expect(await screen.findByText(/Si un compte existe avec abc@gmail\.com/)).toBeTruthy();
  });
});
