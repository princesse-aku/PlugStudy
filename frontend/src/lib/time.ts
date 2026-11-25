import { localeOf, translate, type Lang } from "@/lib/i18n/translate";

/** « il y a 2 h », « hier », « il y a 3 jours » : repères simples pour l'activité récente. */
export function relativeTime(timestamp: number, now: number = Date.now(), lang: Lang = "fr"): string {
  const minutes = Math.floor((now - timestamp) / 60000);
  if (minutes < 1) return translate("à l’instant", lang);
  if (minutes < 60) return translate("il y a {n} min", lang, { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return translate("il y a {n} h", lang, { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 2) return translate("hier", lang);
  return translate("il y a {n} jours", lang, { n: days });
}

/** « 2026-12-12 » devient « 12 déc. » (ou « 12 Dec » en anglais). */
export function shortDate(isoDate: string, lang: Lang = "fr"): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat(localeOf(lang), { day: "numeric", month: "short" }).format(new Date(year, month - 1, day));
}

/** 2 458 000 octets devient « 2,3 Mo » (ou « 2.3 MB »). */
export function fileSizeLabel(bytes: number, lang: Lang = "fr"): string {
  if (bytes < 1024 * 1024) return translate("{n} Ko", lang, { n: Math.max(1, Math.round(bytes / 1024)) });
  const megabytes = (bytes / (1024 * 1024)).toFixed(1);
  return translate("{n} Mo", lang, { n: lang === "fr" ? megabytes.replace(".", ",") : megabytes });
}

/** « Aujourd'hui », « Hier » ou « Il y a 3 jours » (conversations récentes). */
export function dayLabel(timestamp: number, now: number = Date.now(), lang: Lang = "fr"): string {
  const day = (value: number) => {
    const date = new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  };
  const days = Math.round((day(now) - day(timestamp)) / 86400000);
  if (days <= 0) return translate("Aujourd’hui", lang);
  if (days === 1) return translate("Hier", lang);
  return translate("Il y a {n} jours", lang, { n: days });
}

/** Un horodatage devient « 8 déc. » (ou « 8 Dec »). */
export function shortDateOf(timestamp: number, lang: Lang = "fr"): string {
  return new Intl.DateTimeFormat(localeOf(lang), { day: "numeric", month: "short" }).format(new Date(timestamp));
}
