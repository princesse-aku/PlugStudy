import type { StudySession } from "@/lib/types";

const DAY = 24 * 60 * 60 * 1000;
const INITIALS = ["D", "L", "M", "M", "J", "V", "S"];

export interface Bar {
  label: string;
  minutes: number;
}

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Minutes de révision des 7 derniers jours (aujourd'hui en dernier). */
export function dailyMinutes(sessions: StudySession[], now: number = Date.now()): Bar[] {
  const today = startOfDay(now);
  return Array.from({ length: 7 }, (_, index) => {
    const start = today - (6 - index) * DAY;
    const end = start + DAY;
    const minutes = sessions.filter((s) => s.at >= start && s.at < end).reduce((sum, s) => sum + s.minutes, 0);
    return { label: INITIALS[new Date(start).getDay()], minutes };
  });
}

/** Début de la semaine (lundi) contenant ce jour. */
function startOfWeek(timestamp: number): number {
  const day = startOfDay(timestamp);
  const offset = (new Date(day).getDay() + 6) % 7;
  return day - offset * DAY;
}

/** Minutes de révision des 6 dernières semaines, étiquetées par le jour de début (« 2/11 »). */
export function weeklyMinutes(sessions: StudySession[], now: number = Date.now()): Bar[] {
  const thisWeek = startOfWeek(now);
  return Array.from({ length: 6 }, (_, index) => {
    const start = thisWeek - (5 - index) * 7 * DAY;
    const end = start + 7 * DAY;
    const minutes = sessions.filter((s) => s.at >= start && s.at < end).reduce((sum, s) => sum + s.minutes, 0);
    const date = new Date(start);
    return { label: `${date.getDate()}/${date.getMonth() + 1}`, minutes };
  });
}

export const totalMinutes = (bars: Bar[]) => bars.reduce((sum, bar) => sum + bar.minutes, 0);

/** 280 devient « 4 h 40 » ; 45 devient « 45 min » ; 0 devient « 0 min ». */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}
