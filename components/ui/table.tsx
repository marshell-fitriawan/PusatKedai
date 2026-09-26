import type {
  HTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Tabel laporan brutalist (docs/design_1.md): header row `surface-alt` +
 * uppercase, pemisah baris garis 2px ink penuh, angka rata kanan tabular.
 * Bungkus dengan tinggi tetap + overflow agar header sticky punya efek, mis:
 *   <div className="max-h-96 overflow-y-auto"><Table>...</Table></div>
 */
export function Table({
  className,
  ...props
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full border-collapse text-sm", className)}
      {...props}
    />
  );
}

export function THead({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("sticky top-0 z-10 bg-surface-alt", className)}
      {...props}
    />
  );
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TR({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("border-b-2 border-ink hover:bg-primary-light", className)}
      {...props}
    />
  );
}

interface CellProps {
  /** Kolom angka: rata kanan + tabular figures. */
  numeric?: boolean;
}

export function TH({
  numeric = false,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & CellProps) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b-2 border-ink px-3 py-2",
        "font-display text-xs font-bold uppercase tracking-tight",
        numeric ? "text-right" : "text-left",
        className,
      )}
      {...props}
    />
  );
}

export function TD({
  numeric = false,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & CellProps) {
  return (
    <td
      className={cn(
        "px-3 py-2",
        numeric ? "text-right tabular-nums" : "text-left",
        className,
      )}
      {...props}
    />
  );
}
