import type { InputHTMLAttributes } from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Label WAJIB: docs/design_1.md melarang placeholder-as-label. */
  label: string;
  hint?: string;
  error?: string;
  /** Angka (harga, kas, stok) dirata-kanan dan pakai tabular figures. */
  numeric?: boolean;
}

export function Input({
  label,
  hint,
  error,
  numeric = false,
  className,
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={inputId}
        className="font-display text-xs font-bold uppercase tracking-tight"
      >
        {label}
      </label>

      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        inputMode={numeric ? "numeric" : undefined}
        className={cn(
          // Tinggi 44px: input di POS juga tap target.
          "h-11 border-2 bg-surface px-3 text-base",
          "placeholder:text-text-disabled",
          "disabled:bg-surface-alt disabled:text-text-disabled",
          error ? "border-danger" : "border-ink",
          numeric && "text-right tabular",
          className,
        )}
        {...props}
      />

      {error ? (
        <p
          id={`${inputId}-error`}
          className="border-2 border-ink bg-danger px-2 py-1 text-xs font-semibold"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-text-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
