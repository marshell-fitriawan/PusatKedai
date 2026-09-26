"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Ban,
  BarChart3,
  Bell,
  Boxes,
  Clock,
  Factory,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Store,
  Users,
  Wallet,
  Wheat,
  X,
} from "lucide-react";
import { logout } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/perhatian", label: "Perlu Perhatian", icon: Bell },
  { href: "/admin/kedai", label: "Kedai", icon: Store },
  { href: "/admin/produk", label: "Produk", icon: Package },
  { href: "/admin/bahan", label: "Bahan Mentah", icon: Wheat },
  { href: "/admin/produksi", label: "Produksi", icon: Factory },
  { href: "/admin/stok", label: "Stok", icon: Boxes },
  { href: "/admin/mutasi", label: "Mutasi", icon: ArrowLeftRight },
  { href: "/admin/karyawan", label: "Karyawan", icon: Users },
  { href: "/admin/shift", label: "Buka Tutup", icon: Clock },
  { href: "/admin/collect", label: "Setoran", icon: Wallet },
  { href: "/admin/void", label: "Pembatalan", icon: Ban },
  { href: "/admin/pengeluaran", label: "Pengeluaran", icon: Wallet },
  { href: "/admin/laporan", label: "Laporan", icon: BarChart3 },
];

function NavList({
  onNavigate,
  notifCount = 0,
}: {
  onNavigate?: () => void;
  notifCount?: number;
}) {
  const pathname = usePathname();

  return (
    <ul className="flex flex-col gap-1 p-3">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
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
              <span className="flex-1 truncate">{label}</span>
              {href === "/admin/perhatian" && notifCount > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center border-2 border-ink bg-danger px-1.5 text-xs font-bold">
                  {notifCount > 99 ? "99+" : notifCount}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function AccountBlock({ name, role }: { name: string; role: string }) {
  return (
    <div className="mt-auto border-t-2 border-ink p-3">
      <p className="truncate font-display text-sm font-bold uppercase tracking-tight">
          {name}
        </p>
      <p className="mb-2 text-xs text-text-secondary">
        {role === "owner" ? "Owner" : "Admin Pusat"}
      </p>

      {/* Server action dipanggil lewat <form>, bukan onClick -- logout tetap
          berfungsi walau JavaScript belum termuat. */}
      <form action={logout}>
        <button
          type="submit"
          className="tap-target flex w-full items-center gap-2 border-2 border-ink bg-surface px-3 font-display text-xs font-bold uppercase tracking-tight text-ink shadow-brutal-sm press-brutal hover:bg-danger"
        >
          <LogOut className="size-4 shrink-0" aria-hidden />
          Keluar
        </button>
      </form>
    </div>
  );
}

/**
 * Layout admin: sidebar tetap di layar lebar (>= lg), drawer (memakai
 * <dialog> native) di bawah breakpoint itu -- HP dan tablet sempit.
 *
 * Drawer memakai <dialog> native supaya focus trap, kunci scroll latar, dan
 * tombol Esc ditangani browser.
 */
export function AdminShell({
  children,
  clientName,
  adminName,
  adminRole,
  notifCount = 0,
}: {
  children: ReactNode;
  clientName: string;
  adminName: string;
  adminRole: string;
  notifCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // Drawer ditutup lewat onNavigate di tiap link, bukan lewat effect yang
  // memantau pathname -- set state di dalam effect memicu render berlebih
  // dan dilarang lint (react-hooks/set-state-in-effect).

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Sidebar tetap -- hanya layar lebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r-2 border-ink bg-surface lg:flex">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b-2 border-ink bg-primary px-4">
          <Store className="size-5 shrink-0" aria-hidden />
          <span className="truncate font-display text-sm font-bold uppercase tracking-tight">
            {clientName}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavList notifCount={notifCount} />
        </div>
        <AccountBlock name={adminName} role={adminRole} />
      </aside>

      {/* Header mobile */}
      <header className="flex h-14 items-center gap-3 border-b-2 border-ink bg-primary px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Buka menu"
          className="tap-target -ml-2 flex items-center justify-center border-2 border-ink bg-surface text-ink shadow-brutal-sm press-brutal"
        >
          <Menu className="size-6" aria-hidden />
        </button>
        <span className="truncate font-display text-sm font-bold uppercase tracking-tight">
          {clientName}
        </span>
      </header>

      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false);
        }}
        className={cn(
          "m-0 mr-auto h-dvh max-h-none w-72 max-w-[85vw] flex-col border-r-2 border-ink bg-surface p-0",
          // Display mengikuti state, bukan mengandalkan aturan browser
          // `dialog:not([open]) { display: none }` -- utility `flex` di sini
          // menang atas aturan dasar itu, sehingga dialog yang tertutup pun
          // bisa ikut tampil. `hidden`/`flex` dipakai bergantian.
          open ? "flex" : "hidden",
          "backdrop:bg-ink/60 lg:hidden",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b-2 border-ink bg-primary px-4">
          <span className="truncate font-display text-sm font-bold uppercase tracking-tight">
            {clientName}
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
            className="tap-target -mr-2 flex items-center justify-center border-2 border-ink bg-surface text-ink shadow-brutal-sm press-brutal"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavList notifCount={notifCount} onNavigate={() => setOpen(false)} />
        </div>
        <AccountBlock name={adminName} role={adminRole} />
      </dialog>

      <main className="p-4 md:p-6">{children}</main>
    </div>
  );
}
