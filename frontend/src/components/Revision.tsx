"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BookIcon, ChevronLeftIcon } from "@/components/Icons";
import { useI18n } from "@/lib/i18n";
import { importanceLabel, type Importance } from "@/lib/revision";

/** Étiquette de notion : Indispensable, Important, Secondaire. Le cercle (plein, demi, vide) double la couleur. */
export function ImportanceBadge({ level }: { level: Importance }) {
  const { lang } = useI18n();
  const style = {
    indispensable: "bg-accent text-on-accent",
    important: "bg-spark text-black",
    secondaire: "bg-neutral text-neutral-ink",
  }[level];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-[5px] text-[13px] font-semibold ${style}`}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="shrink-0">
        {level === "indispensable" ? (
          <circle cx="6" cy="6" r="5" fill="currentColor" className="text-on-accent" />
        ) : (
          <>
            <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            {level === "important" ? <path d="M6 1.5A4.5 4.5 0 0 1 6 10.5Z" fill="currentColor" /> : null}
          </>
        )}
      </svg>
      {importanceLabel(level, lang)}
    </span>
  );
}

/** Source d'un passage du cours : « Algorithmique, chap. 2, p. 14 ». */
export function SourceChip({ source }: { source: string }) {
  return (
    <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-pale px-3.5 text-sm font-semibold text-pale2">
      <BookIcon size={18} />
      {source}
    </span>
  );
}

/** En-tête d'un écran secondaire : flèche de retour, titre et sous-titre. */
export function BackHeader({
  href,
  title,
  subtitle,
  children,
}: {
  href: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <header className="flex items-center gap-2 px-2 pb-2 pt-3">
      <Link href={href} aria-label={t("Retour")} className="flex h-11 w-11 shrink-0 items-center justify-center">
        <ChevronLeftIcon />
      </Link>
      <div className="flex min-w-0 flex-col">
        <h1 className="font-display text-lg font-bold">{title}</h1>
        {subtitle ? <p className="text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      {children}
    </header>
  );
}

/** Anneau de progression (écrans Suivi et Résultat du quiz). */
export function Ring({ value, size = 112, label }: { value: number; size?: number; label: string }) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="shrink-0">
      <circle cx={center} cy={center} r={radius} fill="none" strokeWidth={stroke} className="stroke-pale" />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(circumference * Math.min(100, Math.max(0, value))) / 100} ${circumference}`}
        transform={`rotate(-90 ${center} ${center})`}
        className="stroke-accent"
      />
      <text
        x={center}
        y={center}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size / 4}
        fontWeight={700}
        className="fill-ink font-display"
      >
        {value} %
      </text>
    </svg>
  );
}

/** Zone de chargement ou d'erreur pleine page d'un écran de cours. */
export function Notice({ children }: { children: ReactNode }) {
  return <p className="mx-5 mt-4 rounded-2xl border border-line bg-card px-4 py-5 text-center text-[15px] leading-relaxed text-muted">{children}</p>;
}
