import { LogOut, Store } from "lucide-react";
import { keluarPos } from "@/app/pos/actions";

/**
 * Header tipis di POS: menunjukkan kasir sedang bertugas di kedai mana.
 *
 * Bukan hiasan. Satu perangkat bisa berpindah tangan antar shift, dan
 * transaksi yang tercatat di kedai yang salah baru ketahui saat tutup buku
 * -- saat sudah terlambat diperbaiki.
 *
 * Hanya di layar kecil. Di tablet/desktop, SideNav sudah membawa nama kedai,
 * nama kasir, dan tombol keluar, jadi header ini disembunyikan agar tidak ada
 * dua identitas yang sama tampil dua kali.
 */
export function PosHeader({
  kedaiName,
  employeeName,
}: {
  kedaiName: string;
  employeeName: string;
}) {
  return (
    <header className="sticky top-0 z-10 border-b-2 border-ink bg-primary lg:hidden">
      <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
        <Store className="size-5 shrink-0" aria-hidden />

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold uppercase tracking-tight">
            {kedaiName}
          </p>
          <p className="truncate text-xs">{employeeName}</p>
        </div>

        <form action={keluarPos}>
          <button
            type="submit"
            aria-label="Akhiri sesi kasir"
            className="tap-target -mr-2 flex items-center justify-center border-2 border-ink bg-surface text-ink shadow-brutal-sm press-brutal"
          >
            <LogOut className="size-5" aria-hidden />
          </button>
        </form>
      </div>
    </header>
  );
}
