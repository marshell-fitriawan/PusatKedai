import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Gabungkan class Tailwind dengan aman: class yang datang belakangan menang
 * kalau bertabrakan (mis. `px-4` di komponen ditimpa `px-6` dari pemanggil).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format mata uang ringgit (RM) tanpa desimal -- harga dan kas selalu bulat.
 * Klien memakai RM, UI tetap berbahasa Indonesia (docs/Database.md §1).
 */
export function formatUang(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
