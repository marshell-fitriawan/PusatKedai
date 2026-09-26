import { WifiOff } from "lucide-react";

export const metadata = {
  title: "Tidak ada koneksi",
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <div className="border-2 border-ink bg-surface p-6 text-center shadow-brutal">
        <span className="mx-auto flex size-12 items-center justify-center border-2 border-ink bg-warning text-ink shadow-brutal-sm">
          <WifiOff className="size-6 text-ink" aria-hidden />
        </span>

        <h1 className="mt-4 text-xl font-bold">Tidak ada koneksi</h1>

        <p className="mt-2 text-sm text-text-secondary">
          Halaman ini belum tersimpan di perangkat. Buka kembali setelah
          koneksi pulih.
        </p>

        <p className="mt-4 text-sm text-text-secondary">
          Transaksi yang sudah dibuat tetap tersimpan di HP dan akan terkirim
          otomatis begitu online.
        </p>
      </div>
    </main>
  );
}
