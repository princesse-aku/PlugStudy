import type { AppUser } from "@/lib/types";

/** Prénom à afficher dans « Bonjour, … » : nom Google, sinon début de l'e-mail. */
export function firstName(user: AppUser | null): string {
  if (!user) return "";
  const fromName = user.displayName?.trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const fromEmail = user.email?.split("@")[0]?.split(/[._-]/)[0];
  if (fromEmail) return fromEmail.charAt(0).toUpperCase() + fromEmail.slice(1);
  return "";
}
