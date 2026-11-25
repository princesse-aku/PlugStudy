"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n";

/** Logo horizontal PlugStudy (fond transparent, à poser sur fond clair). */
export function Logo({ width, className = "" }: { width: number; className?: string }) {
  const { t } = useI18n();
  return (
    <Image
      src="/logo.png"
      alt={t("PlugStudy")}
      width={1430}
      height={380}
      priority
      className={`h-auto ${className}`}
      style={{ width }}
    />
  );
}
