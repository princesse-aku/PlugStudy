import Link from "next/link";
import { CheckIcon, HalfCircleIcon } from "@/components/Icons";
import { isDone } from "@/lib/courses";
import { shortDate } from "@/lib/time";
import type { Course } from "@/lib/types";

/** Barre de progression : la valeur est aussi écrite en toutes lettres à côté (jamais la couleur seule). */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className="h-2 overflow-hidden rounded bg-pale"
    >
      <div className="h-2 bg-accent" style={{ width: `${value}%` }} />
    </div>
  );
}

function subtitle(course: Course): string {
  if (course.status === "preparing") return "Préparation en cours…";
  if (course.status === "error") return "Préparation impossible";
  if (isDone(course)) return "Tout révisé";
  if (course.examDate) return `Examen : ${shortDate(course.examDate)}`;
  return "Pas de date d’examen";
}

/** Carte d'un cours dans « Mes cours » (écrans 10 et 13). */
export function CourseCard({ course }: { course: Course }) {
  const done = isDone(course);
  return (
    <Link
      href={`/cours/${course.id}`}
      className="flex min-h-[88px] flex-col gap-2 rounded-2xl border border-line bg-card p-3.5 text-ink"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-[17px] font-bold">{course.name}</span>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-[5px] text-[13px] font-semibold ${
            course.status === "error" ? "bg-danger-bg text-danger" : done ? "bg-accent text-on-accent" : "bg-pale text-pale2"
          }`}
        >
          {done || course.status === "error" ? null : <HalfCircleIcon />}
          {done ? <CheckIcon size={14} /> : null}
          {course.status === "error" ? "À refaire" : done ? "Terminé" : "En cours"}
        </span>
      </div>
      <span className="text-[13px] text-muted">{subtitle(course)}</span>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <ProgressBar value={course.progress} label={`Progression de ${course.name}`} />
        </div>
        <span className="min-w-11 text-right text-sm font-bold text-pale2">{course.progress} %</span>
      </div>
    </Link>
  );
}
