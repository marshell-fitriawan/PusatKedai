"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Clock, History, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bottom navigation POS (docs/design_1.md).
 *
 * Bukan sidebar: kasir memegang HP satu tangan, jadi navigasi harus berada
 * dalam jangkauan ibu jari. Maksimal 4-5 item -- lebih dari itu tiap target
 * jadi terlalu sempit untuk dipencet cepat.
 *
 * Hanya di layar kecil. Di tablet/desktop digantikan SideNav vertikal.
 *
 * Absensi dihapus bersama tabel `attendance` (migration 0014) -- ritel tak
 * perlu presence tracking sendiri; Shift dan Riwayat cukup.
 */
const items = [
  { href: "/pos/kasir", label: "Kasir", icon: ShoppingCart },
  { href: "/pos/stok", label: "Stok", icon: Boxes },
  { href: "/pos/riwayat", label: "Riwayat", icon: History },
  { href: "/pos/shift", label: "Shift", icon: Clock },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigasi utama"
      className={cn(
        "fixed inset-x-0 bottom-0 z-20 border-t-2 border-ink bg-surface lg:hidden",
        // Hindari tertutup gesture bar iOS/Android.
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="mx-auto flex max-w-lg">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href} className="flex-1 border-r-2 border-ink last:border-r-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1",
                  "font-display text-xs font-bold uppercase tracking-tight",
                  "border-t-4 transition-colors",
                  active
                    ? "border-t-primary bg-primary text-ink"
                    : "border-t-transparent bg-surface text-text-secondary hover:bg-surface-alt",
                )}
              >
                <Icon className="size-6" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
