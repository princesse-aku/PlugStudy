import { forwardRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { ChevronDownIcon, EyeIcon, EyeOffIcon } from "./Icons";

const control =
  "h-[52px] w-full rounded-xl border border-field bg-card px-4 text-base text-ink placeholder:text-muted aria-[invalid=true]:border-2 aria-[invalid=true]:border-danger";

/** Libellé + champ + aide ou erreur. L'identifiant du champ doit être `id`. */
export function Field({
  id,
  label,
  optional,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {optional ? <span className="font-normal text-muted"> (optionnel)</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] leading-snug text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] leading-snug text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** À passer au champ pour relier l'aide ou l'erreur affichée par <Field>. */
export function describedBy(id: string, hint?: string, error?: string | null) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className = "", ...props }, ref) {
    return <input ref={ref} className={`${control} ${className}`} {...props} />;
  }
);

export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput({ className = "", ...props }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          className={`${control} pr-14 ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
          className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-lg text-muted"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    );
  }
);

export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={`${control} appearance-none pr-12 ${className}`} {...props}>
        {children}
      </select>
      <span className="pointer-events-none absolute right-3.5 top-3.5 text-muted">
        <ChevronDownIcon />
      </span>
    </div>
  );
}

/** Choix exclusif entre quelques options courtes (ex. la langue). */
export function Segmented<T extends string>({
  label,
  optional,
  value,
  options,
  onChange,
}: {
  label: string;
  optional?: boolean;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label}>
      <div className="text-sm font-semibold text-ink">
        {label}
        {optional ? <span className="font-normal text-muted"> (optionnel)</span> : null}
      </div>
      <div className="flex gap-3">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`min-h-12 flex-1 rounded-xl text-[15px] ${
                selected
                  ? "border-2 border-accent bg-pale font-bold text-pale2"
                  : "border border-field bg-card font-medium text-ink"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
