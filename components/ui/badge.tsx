import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Status badge brutalist (docs/design_1.md).
 *
 * Bentuk: persegi kecil (radius 2px -- satu-satunya pengecualian radius di
 * sistem ini), border 2px ink, ISI warna semantik solid dengan teks kontras
 * (hitam, kecuali info yang biru). Badge semi transparan (mis. warna semantik
 * dengan opacity 15%) DILARANG -- di layar HP di bawah cahaya terang, warna solid
 * + border hitam jauh lebih mudah dibaca.
 *
 * Warna semantik hanya untuk status yang benar-benar berarti, tidak untuk
 * dekorasi -- supaya kasir bisa paham dari warna tanpa membaca teksnya.
 */
type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const toneClass: Record<Tone, string> = {
  success: "bg-success text-ink",
  warning: "bg-warning text-ink",
  danger: "bg-danger text-ink",
  info: "bg-info text-white",
  neutral: "bg-surface-alt text-text-secondary",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border-2 border-ink px-2 py-0.5",
        "font-display text-xs font-bold uppercase tracking-tight",
        toneClass[tone],
        className,
      )}
      {...props}
    />
  );
}
