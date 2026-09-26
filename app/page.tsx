import Link from "next/link";
import { LayoutDashboard, ShoppingCart, Store } from "lucide-react";
import { AuthShell } from "@/components/ui/auth-shell";

/**
 * Halaman pertama: pilih mau masuk sebagai kasir atau sebagai admin.
 *
 * Kedua tautan sengaja mengarah ke halaman MASUK, bukan ke halaman tujuan
 * (/pos/kasir dan /admin/dashboard). Halaman tujuan itu sudah terlindungi
 * middleware, jadi kalau belum ada sesi, middleware akan melempar balik ke
 * halaman masuk. Menautkan langsung ke halaman masuk menghemat satu
 * perpindahan dan tidak menampilkan "halaman kosong lalu pindah".
 *
 * TODO: setelah ada auto-alih berdasarkan sesi yang aktif, halaman ini
 * hanya dipakai sebagai fallback (mis. sesi kadaluwarsa di tengah jalan).
 */
const entries = [
  {
    href: "/pos/masuk",
    label: "Kasir",
    description: "Untuk karyawan di kedai",
    icon: ShoppingCart,
  },
  {
    href: "/admin/login",
    label: "Admin Pusat",
    description: "Untuk owner dan admin",
    icon: LayoutDashboard,
  },
];

export default function Home() {
  return (
    <AuthShell
      title="Pilih akses"
      clientName={process.env.NEXT_PUBLIC_CLIENT_NAME ?? "Instance pengembangan"}
      icon={Store}
      headline="Satu sistem untuk semua kedai Anda."
      tagline="Kasir jalan dari HP, laporan dan stok terkumpul di satu tempat. Disusun supaya setiap kedai punya catatan yang sama."
      points={[
        "Kasir tetap jalan saat internet mati, lalu tersinkron otomatis",
        "Stok dan mutasi antar kedai tercatat satu per satu",
        "Omzet, laba-rugi, dan pengeluaran bisa dilihat per cabang",
        "Karyawan masuk lewat kartu QR, buka-tutup toko tercatat",
      ]}
    >
      <nav className="grid gap-3 sm:grid-cols-2">
        {entries.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="tap-target flex items-center gap-4 border-2 border-ink bg-surface p-4 shadow-brutal press-brutal hover:bg-primary-light"
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
    </AuthShell>
  );
}
