import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

/**
 * Neo-brutalism (docs/design_1.md): kotak siku, border 2px ink, shadow hard
 * offset tanpa blur. Tombol TIDAK berubah warna saat hover -- efeknya datang
 * dari `press-brutal` (terdorong 2px, shadow hilang) saat ditekan.
 */
const variantClass: Record<Variant, string> = {
  // Kuning solid + teks hitam. Kuning + teks putih tidak memenuhi kontras.
  primary: "bg-primary text-ink",
  secondary: "bg-surface text-ink",
  // Tanpa background/border/shadow, hanya teks_action dengan underline.
  ghost: "bg-transparent text-ink underline underline-offset-4",
  // Hanya untuk aksi merusak (void transaksi, tolak mutasi), bukan dekorasi.
  danger: "bg-danger text-ink",
};

const sizeClass: Record<Size, string> = {
  // sm di bawah 44px -- HANYA untuk dashboard admin di layar lebar.
  // Jangan dipakai di POS.
  sm: "h-9 px-3 text-xs",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Lebar penuh -- lazim untuk tombol aksi utama di layar HP. */
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2",
        "font-display font-bold uppercase tracking-tight",
        "border-2 border-ink",
        // Ghost tidak memakai `shadow-brutal` sama sekali, jadi tidak perlu
        // reset shadow. `border-0` tetap dipakai untuk membuang border.
        variant === "ghost" ? "border-0" : "shadow-brutal press-brutal",
        variantClass[variant],
        sizeClass[size],
        fullWidth && "w-full",
        // Reset shadow + efek tekan saat disabled ditangani `press-brutal`
        // itu sendiri (:disabled), bukan `disabled:shadow-none` — lihat
        // app/globals.css.
        "disabled:cursor-not-allowed disabled:border-ink/30 disabled:bg-surface-alt disabled:text-text-disabled",
        className,
      )}
      {...props}
    />
  );
}
