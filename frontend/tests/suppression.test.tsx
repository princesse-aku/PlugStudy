import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { router } from "./setup";
import { AuthProvider } from "@/lib/auth-context";
import SuppressionPage from "@/app/profil/suppression/page";

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const UID = "demo-honorat";
const wrap = () => render(<AuthProvider><SuppressionPage /></AuthProvider>);
const write = (key: string, value: unknown) => window.localStorage.setItem(key, JSON.stringify(value));

function seed() {
  write("plugstudy:demo:user", { uid: UID, email: "honorat@gmail.com", displayName: "Honorat Dossou", emailVerified: true });
  write(`plugstudy:demo:profile:${UID}`, { niveau: "Licence 1", filiere: "Informatique", universite: "UAC", langue: "fr" });
  write(`plugstudy:demo:courses:${UID}`, [{ id: "c1", name: "Algorithmique" }]);
  write(`plugstudy:demo:col:users/${UID}/courses/c1/notions`, [{ id: "n1" }]);
  write(`plugstudy:demo:col:users/${UID}/attempts`, [{ id: "t1" }]);
  // Les données d'un autre compte ne doivent pas être touchées.
  write("plugstudy:demo:profile:demo-autre", { niveau: "Master", filiere: "Droit", universite: "UAC", langue: "fr" });
}

beforeEach(() => window.localStorage.clear());

describe("Supprimer mon compte (écran 31)", () => {
  it("liste ce qui sera supprimé et garde « Supprimer définitivement » grisé tant qu'on n'a pas écrit SUPPRIMER", async () => {
    seed();
    wrap();
    expect(await screen.findByText("Tout sera supprimé")).toBeTruthy();
    for (const item of ["Tes cours et leurs fichiers", "Ton planning", "Ton profil et ton adresse e-mail"]) {
      expect(screen.getByText(item)).toBeTruthy();
    }
    const button = screen.getByRole("button", { name: "Supprimer définitivement" });
    expect(button.hasAttribute("disabled")).toBe(true);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Pour confirmer, écris SUPPRIMER"), "SUPPRIM");
    expect(button.hasAttribute("disabled")).toBe(true);
    await user.type(screen.getByLabelText("Pour confirmer, écris SUPPRIMER"), "ER");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("link", { name: "Annuler" }).getAttribute("href")).toBe("/profil");
  });

  it("supprime le compte et ses données, laisse les autres comptes, puis retourne à la connexion", async () => {
    seed();
    const user = userEvent.setup();
    wrap();
    await user.type(await screen.findByLabelText("Pour confirmer, écris SUPPRIMER"), "supprimer");
    await user.click(screen.getByRole("button", { name: "Supprimer définitivement" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/connexion"));
    expect(window.localStorage.getItem("plugstudy:demo:user")).toBeNull();
    expect(window.localStorage.getItem(`plugstudy:demo:profile:${UID}`)).toBeNull();
    expect(window.localStorage.getItem(`plugstudy:demo:courses:${UID}`)).toBeNull();
    expect(window.localStorage.getItem(`plugstudy:demo:col:users/${UID}/courses/c1/notions`)).toBeNull();
    expect(window.localStorage.getItem(`plugstudy:demo:col:users/${UID}/attempts`)).toBeNull();
    expect(window.localStorage.getItem("plugstudy:demo:profile:demo-autre")).not.toBeNull();
  });
});
