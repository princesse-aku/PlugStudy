import Image from "next/image";

/** Logo horizontal PlugStudy (fond transparent, à poser sur fond clair). */
export function Logo({ width, className = "" }: { width: number; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="PlugStudy"
      width={1430}
      height={380}
      priority
      className={`h-auto ${className}`}
      style={{ width }}
    />
  );
}
