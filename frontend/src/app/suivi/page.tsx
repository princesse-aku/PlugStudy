"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ProgressBar } from "@/components/CourseCard";
import { Ring } from "@/components/Revision";
import { dailyMinutes, formatMinutes, totalMinutes, weeklyMinutes, type Bar } from "@/lib/activity";
import { useAuth } from "@/lib/auth-context";
import { useFeatureGate } from "@/lib/use-feature-gate";
import { averageProgress } from "@/lib/courses";
import { useSessions } from "@/lib/data";
import { progressMessage } from "@/lib/revision";
import { useCourses } from "@/lib/use-courses";

type Mode = "jour" | "semaine";

function Bars({ bars, ariaLabel }: { bars: Bar[]; ariaLabel: string }) {
  const max = Math.max(60, ...bars.map((bar) => bar.minutes));
  return (
    <div>
      <div role="img" aria-label={ariaLabel} className="flex h-32 items-end gap-2">
        {bars.map((bar, index) => (
          <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-xs text-muted">{bar.minutes}</span>
            <div
              className="w-full rounded-t-md bg-accent"
              style={{ height: `${bar.minutes === 0 ? 3 : Math.max(6, (bar.minutes / max) * 100)}%`, opacity: bar.minutes === 0 ? 0.25 : 1 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2" aria-hidden="true">
        {bars.map((bar, index) => (
          <div key={index} className="flex-1 text-center text-xs font-medium text-muted">
            {bar.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Écrans 24 · Suivi (vue Jour) et 30 · vue Semaine : progression globale, activité, progression par cours. */
export default function SuiviPage() {
  const enabled = useFeatureGate("suivi", "/accueil");
  const { user } = useAuth();
  const { courses } = useCourses(user?.uid);
  const { sessions } = useSessions(user?.uid);
  const [mode, setMode] = useState<Mode>("jour");

  const global = averageProgress(courses);
  const message = progressMessage(global);
  const bars = mode === "jour" ? dailyMinutes(sessions) : weeklyMinutes(sessions);
  const total = totalMinutes(bars);
  const span = mode === "jour" ? "7 jours" : "6 semaines";

  if (!enabled) return null;

  return (
    <AppShell active="suivi">
      <header className="flex flex-col gap-0.5 px-5 pb-2 pt-6">
        <h1 className="font-display text-[26px] font-bold leading-tight">Suivi</h1>
        <p className="text-[15px] text-muted">Où tu en es avant l’examen.</p>
      </header>

      <div className="flex flex-col gap-3 px-5 pt-2">
        <section aria-label="Progression globale" className="flex items-center gap-4 rounded-[20px] border border-line bg-card p-4">
          <Ring value={global} label={`Progression globale : ${global} %`} />
          <div className="flex flex-col gap-1">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted">Progression globale</h2>
            <p className="font-display text-xl font-bold leading-tight">{message.title}</p>
            <p className="text-[15px] text-muted">{message.text}</p>
          </div>
        </section>

        <section aria-labelledby="activite" className="flex flex-col gap-3 rounded-[20px] border border-line bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col">
              <h2 id="activite" className="font-display text-base font-bold">
                Ton activité
              </h2>
              <p className="text-[13px] text-muted">
                Minutes de révision · {formatMinutes(total)} sur {span}
              </p>
            </div>
            <div role="group" aria-label="Période" className="flex shrink-0 rounded-full bg-pale p-0.5">
              {(["jour", "semaine"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={mode === item}
                  onClick={() => setMode(item)}
                  className={`min-h-11 rounded-full px-3.5 text-sm ${
                    mode === item ? "bg-card font-bold text-ink" : "font-medium text-muted"
                  }`}
                >
                  {item === "jour" ? "Jour" : "Semaine"}
                </button>
              ))}
            </div>
          </div>
          <Bars
            bars={bars}
            ariaLabel={`Minutes de révision sur ${mode === "jour" ? "les 7 derniers jours" : "les 6 dernières semaines"} : ${bars
              .map((bar) => bar.minutes)
              .join(", ")}`}
          />
        </section>

        <h2 className="mt-1 font-display text-lg font-bold">Par cours</h2>
        {courses.length === 0 ? (
          <p className="rounded-2xl border border-line bg-card px-4 py-4 text-[15px] text-muted">
            Ajoute un cours pour suivre ta progression.
          </p>
        ) : (
          <ul className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
            {courses.map((course) => (
              <li key={course.id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[15px]">
                  <span className="font-semibold">{course.name}</span>
                  <span className="font-bold text-pale2">{course.progress} %</span>
                </div>
                <ProgressBar value={course.progress} label={`Progression de ${course.name}`} />
              </li>
            ))}
          </ul>
        )}

        <p className="text-[13px] leading-snug text-muted">
          Calculée à partir de tes séances et de tes quiz. Ce n’est pas une prédiction de note.
        </p>
      </div>
    </AppShell>
  );
}
