"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Clock, History, LogOut, ShoppingCart, Store } from "lucide-react";
import { keluarPos } from "@/app/pos/actions";
import { cn } from "@/lib/utils";

/**
 * Navigasi POS untuk layar lebar (tablet dan desktop).
 *
 * Padanan vertikal dari BottomNav. Di HP bottom nav tetap yang dipakai --
 * kasir memegang HP satu tangan, dan navigasi harus berada dalam jangkauan
 * ibu jari. Item dan urutannya sengaja DICUKUP SAMA persis dengan
 * BottomNav supaya kasir yang pindah perangkat tidak menemukan menu di tempat
 * berbeda.
 *
 * Breakpoint `md` (768px), bukan `lg` seperti sidebar admin. Alasannya device
 * target POS berbeda: dashboard admin dipakai orang yang duduk di meja dengan
 * tetikus, sedangkan POS dipakai di meja kasir yang sering berupa tablet
 * berdiri tegak. Tablet potret 768px sudah cukup lapang untuk nav samping.
 */
const items = [
  { href: "/pos/kasir", label: "Kasir", icon: ShoppingCart },
  { href: "/pos/stok", label: "Stok", icon: Boxes },
  { href: "/pos/riwayat", label: "Riwayat", icon: History },
  { href: "/pos/shift", label: "Shift", icon: Clock },
];

export function SideNav({
  kedaiName,
  employeeName,
}: {
  kedaiName: string;
  employeeName: string;
}) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Navigasi utama"
      className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r-2 border-ink bg-surface lg:flex"
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b-2 border-ink bg-primary px-4">
        <Store className="size-5 shrink-0" aria-hidden />
        <span className="truncate font-display text-sm font-bold uppercase tracking-tight">
          {kedaiName}
        </span>
      </div>

      <ul className="flex flex-1 flex-col gap-1 p-3">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 border-2 border-ink px-3",
                  "font-display text-xs font-bold uppercase tracking-tight",
                  "transition-colors",
                  active
                    ? "bg-primary text-ink"
                    : "bg-surface text-text-secondary hover:bg-primary-light hover:text-ink",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/*
        Identitas kasir dan keluar-tombol pindah ke sini di layar lebar,
        menggantikan PosHeader yang disembunyikan pada breakpoint yang sama.
        Kalau keduanya tampil bersamaan, logout jadi dua tombol dengan label
        sama di satu layar.
      */}
      <div className="border-t-2 border-ink p-3">
        <p className="truncate font-display text-sm font-bold uppercase tracking-tight">
          {employeeName}
        </p>

        <form action={keluarPos} className="mt-2">
          <button
            type="submit"
            className="tap-target flex w-full items-center gap-2 border-2 border-ink bg-surface px-3 font-display text-xs font-bold uppercase tracking-tight text-ink shadow-brutal-sm press-brutal hover:bg-danger"
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            Keluar
          </button>
        </form>
      </div>
    </aside>
  );
}
