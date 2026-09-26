import Link from "next/link";
import { ChevronLeft, Store } from "lucide-react";
import { MasukForm } from "@/components/pos/masuk-form";

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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-8">
      <Link
        href="/"
        className="tap-target -ml-2 mb-4 inline-flex w-fit items-center gap-1 px-2 text-sm font-semibold underline underline-offset-4 hover:bg-primary-light"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Kembali
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <span className="flex size-12 items-center justify-center border-2 border-ink bg-primary text-ink shadow-brutal">
          <Store className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-bold">Mulai Sesi Kasir</h1>
          <p className="text-sm text-text-secondary">
            {process.env.NEXT_PUBLIC_CLIENT_NAME ?? "Sistem Multi-Kedai"}
          </p>
        </div>
      </div>

      <div className="border-2 border-ink bg-surface p-6 shadow-brutal">
        <MasukForm />
      </div>

      <p className="mt-4 text-center text-xs text-text-secondary">
        Pindai kartu QR pribadi Anda. Kedai ditentukan otomatis dari kartu itu.
      </p>
    </main>
  );
}
