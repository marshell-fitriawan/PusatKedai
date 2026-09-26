import Link from "next/link";
import { LayoutDashboard, ShoppingCart, Store } from "lucide-react";

// Sementara: pemilihan mode masih manual. Setelah M0-9 (auth admin) dan M3-4
// (sesi karyawan via QR) selesai, halaman ini diganti pengalihan otomatis
// berdasarkan sesi yang aktif.
const entries = [
  {
    href: "/pos/kasir",
    label: "Kasir",
    description: "Untuk karyawan di kedai",
    icon: ShoppingCart,
  },
  {
    href: "/admin/dashboard",
    label: "Admin Pusat",
    description: "Untuk owner dan admin",
    icon: LayoutDashboard,
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center border-2 border-ink bg-primary text-ink shadow-brutal">
          <Store className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-bold">Sistem Multi-Kedai</h1>
          <p className="text-sm text-text-secondary">
            {process.env.NEXT_PUBLIC_CLIENT_NAME ?? "Instance pengembangan"}
          </p>
        </div>
      </div>

      <nav className="mt-6 flex flex-col gap-3">
        {entries.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 border-2 border-ink bg-surface p-4 shadow-brutal press-brutal hover:bg-primary-light"
          >
            <span className="flex size-10 shrink-0 items-center justify-center border-2 border-ink bg-primary text-ink">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="flex flex-col">
              <span className="font-display text-sm font-bold uppercase tracking-tight">
                {label}
              </span>
              <span className="text-sm text-text-secondary">{description}</span>
            </span>
          </Link>
        ))}
      </nav>

      <p className="mt-6 text-sm text-text-secondary">
        Modul-modulnya belum dibangun. Urutan pengerjaan ada di{" "}
        <code className="border-2 border-ink bg-surface-alt px-1 py-0.5 text-xs">
          docs/Tasks.md
        </code>
        .
      </p>
    </main>
  );
}
