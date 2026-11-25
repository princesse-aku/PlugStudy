/** « prenom@gmail.com » devient « p•••@gmail.com ». */
export function maskEmail(email: string | null): string {
  if (!email) return "ton adresse e-mail";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.charAt(0)}•••@${domain}`;
}
