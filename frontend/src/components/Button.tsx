import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary";

const base =
  "flex min-h-[52px] w-full items-center justify-center rounded-[14px] px-4 text-base font-semibold transition-colors disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-deep disabled:bg-pale disabled:text-muted",
  secondary: "border-2 border-accent bg-card text-deep hover:bg-pale disabled:opacity-60",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  children,
}: {
  href: string;
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${base} ${variants[variant]}`}>
      {children}
    </Link>
  );
}
