import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InstallBanner } from "@/components/InstallBanner";

function fireInstallPrompt(outcome: "accepted" | "dismissed" = "accepted") {
  const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe("Bandeau d'installation", () => {
  it("n'apparaît pas tant que le navigateur ne propose pas l'installation", () => {
    render(<InstallBanner />);
    expect(screen.queryByText("Installe PlugStudy")).toBeNull();
  });

  it("ouvre la fenêtre d'installation du navigateur puis disparaît", async () => {
    const user = userEvent.setup();
    render(<InstallBanner />);
    const event = fireInstallPrompt("accepted");
    await user.click(await screen.findByRole("button", { name: "Installer" }));
    expect(event.prompt).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("Installe PlugStudy")).toBeNull());
  });

  it("se ferme avec « Plus tard » et ne revient pas", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<InstallBanner />);
    fireInstallPrompt();
    await user.click(await screen.findByRole("button", { name: "Plus tard" }));
    expect(screen.queryByText("Installe PlugStudy")).toBeNull();
    unmount();
    render(<InstallBanner />);
    fireInstallPrompt();
    expect(screen.queryByText("Installe PlugStudy")).toBeNull();
  });
});
