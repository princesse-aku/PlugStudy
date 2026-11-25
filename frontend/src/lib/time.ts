/** « il y a 2 h », « hier », « il y a 3 jours » : repères simples pour l'activité récente. */
export function relativeTime(timestamp: number, now: number = Date.now()): string {
  const minutes = Math.floor((now - timestamp) / 60000);
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 2) return "hier";
  return `il y a ${days} jours`;
}

/** « 2026-12-12 » devient « 12 déc. ». */
export function shortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(year, month - 1, day));
}

/** 2 458 000 octets devient « 2,3 Mo ». */
export function fileSizeLabel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/** « Aujourd'hui », « Hier » ou « Il y a 3 jours » (conversations récentes). */
export function dayLabel(timestamp: number, now: number = Date.now()): string {
  const day = (value: number) => {
    const date = new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  };
  const days = Math.round((day(now) - day(timestamp)) / 86400000);
  if (days <= 0) return "Aujourd’hui";
  if (days === 1) return "Hier";
  return "Il y a " + days + " jours";
}

/** Un horodatage devient « 8 déc. ». */
export function shortDateOf(timestamp: number): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(timestamp));
}
