import type { SelectHTMLAttributes } from "react";
import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Label wajib, sama alasannya dengan Input: placeholder bukan label. */
  label: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({
  label,
  hint,
  error,
  options,
  className,
  id,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const describedBy = error
    ? `${selectId}-error`
    : hint
      ? `${selectId}-hint`
      : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={selectId}
        className="font-display text-xs font-bold uppercase tracking-tight"
      >
        {label}
      </label>

      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            // Tinggi 44px -- select juga tap target di HP.
            "h-11 w-full appearance-none border-2 bg-surface pr-10 pl-3 text-base",
            "disabled:bg-surface-alt disabled:text-text-disabled",
            error ? "border-danger" : "border-ink",
            className,
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink"
          aria-hidden
        />
      </div>

      {error ? (
        <p
          id={`${selectId}-error`}
          className="border-2 border-ink bg-danger px-2 py-1 text-xs font-semibold"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={`${selectId}-hint`} className="text-xs text-text-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
