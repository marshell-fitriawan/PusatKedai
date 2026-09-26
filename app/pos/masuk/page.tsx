import { Store } from "lucide-react";
import { MasukForm } from "@/components/pos/masuk-form";
import { AuthShell } from "@/components/ui/auth-shell";

export const metadata = {
  title: "Mulai Sesi — Kasir",
};

/**
 * Halaman masuk kasir. Sengaja berada DI LUAR app/pos/(kasir)/ -- kalau ikut
 * di dalam grup itu, layout-nya akan mengalihkan halaman ini ke dirinya
 * sendiri tanpa henti.
 *
 * Tidak mengambil data apa pun dari database. Daftar karyawan tidak boleh
 * ditampilkan di sini: halaman ini bisa diakses siapa saja, dan menampilkan
 * nama seluruh karyawan beserta cabangnya kepada orang yang belum
 * terverifikasi tidak ada gunanya untuk kasir.
 */
export default function MasukPage() {
  return (
    <AuthShell
      title="Mulai Sesi Kasir"
      clientName={process.env.NEXT_PUBLIC_CLIENT_NAME ?? "Sistem Multi-Kedai"}
      icon={Store}
      backHref="/"
      headline="Mulai kerja di kedai Anda."
      tagline="Pindai kartu QR pribadi, lalu shift Anda terbuka sampai Anda menutup toko. Sesi mengikat semua transaksi ke nama Anda."
      points={[
        "Buka shift cukup dengan memindai kartu QR",
        "Kedai dan nama Anda terisi otomatis dari kartu itu",
        "Transaksi tetap tersimpan walau internet mati",
        "Tutup toko dengan menghitung kas fisik",
      ]}
      hint="Pindai kartu QR pribadi Anda. Kedai ditentukan otomatis dari kartu itu."
    >
      <div className="border-2 border-ink bg-surface p-6 shadow-brutal">
        <MasukForm />
      </div>
    </AuthShell>
  );
}
