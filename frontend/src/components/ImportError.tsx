"use client";

import type { ReactNode } from "react";
import { FileIcon } from "@/components/Icons";
import { errorMessage } from "@/lib/detail";
import type { ImportProblem } from "@/lib/courses";
import { useI18n } from "@/lib/i18n";
import { fileSizeLabel } from "@/lib/time";
import type { Course } from "@/lib/types";

/**
 * Écran 28 · Erreur d'import : le fichier (en rouge), la raison, le conseil et les formats acceptés.
 * Sert à l'écran d'ajout (fichier refusé avant l'envoi) et au détail du cours (préparation échouée) ; `action` : le bouton « Choisir un autre fichier ».
 */
export function ImportError({
  fileName,
  fileSize,
  reason,
  action,
}: {
  fileName: string;
  fileSize?: number;
  reason: Course["errorReason"] | ImportProblem;
  action?: ReactNode;
}) {
  const { t, lang } = useI18n();
  const message = errorMessage(reason);
  return (
    <section role="alert" aria-labelledby="import-erreur" className="flex flex-col gap-3">
      {fileName ? (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-danger bg-danger-bg p-3.5">
          <span className="text-danger">
            <FileIcon size={28} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="break-words text-base font-semibold">{fileName}</span>
            {fileSize ? <span className="text-[13px] text-muted">{fileSizeLabel(fileSize, lang)}</span> : null}
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card px-4 py-4">
        <h2 id="import-erreur" className="font-display text-xl font-bold text-danger">
          {t(message.title)}
        </h2>
        <p className="text-[15px] leading-relaxed">{t(message.text)}</p>
        <p className="text-[13px] leading-snug text-muted">{t("Formats acceptés : PDF, DOCX, PPTX ou TXT.")}</p>
      </div>
      {action}
    </section>
  );
}
