import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/pos/bottom-nav";
import { PosHeader } from "@/components/pos/pos-header";
import { SideNav } from "@/components/pos/side-nav";
import { getPosSession } from "@/lib/pos/session";

/**
 * Gerbang sesi kasir.
 *
 * Diletakkan di layout supaya setiap halaman POS otomatis terlindungi --
 * pola yang sama dengan app/admin/(dashboard)/layout.tsx.
 *
 * Halaman /pos/masuk sengaja berada DI LUAR grup ini. Kalau ikut di dalam,
 * halaman itu akan mengalihkan ke dirinya sendiri tanpa henti.
 *
 * Navigasi berdua, dipilih lewat CSS -- bukan deteksi viewport di JavaScript.
 * Alasannya: mendeteksi viewport di server akan memunculkan hydration
 * mismatch, dan JS hanya untuk menyembunyikan elemen yang bisa disembunyikan
 * CSS.
 *
 *   lebar        SideNav    PosHeader  BottomNav  main
 *   -----------  ---------  ---------  ---------  --------------------------
 *   < 1024px    tersembunyi  tampil     fixed     max-w-lg, pb-20
 *   >= 1024px   sticky      tersembunyi  --        mengisi sisa ruang
 *
 * Breakpoint `lg` (1024px) sama dengan sidebar admin (admin-shell.tsx), dan
 * itu pilihan sadar: tablet POS di meja kasir hampir selalu dipasang landscape
 * (1024px atau lebih). Tablet potret 768-1023px sengaja TIDAK memakai split
 * tiga kolom -- sidebar 224px + panel keranjang 320px hanya menyisakan 224px
 * untuk grid produk, dan produk jadi mustahil dipencet. Di rentang itu
 * layout HP yang tetap dipakai; keranjang masih bisa dibuka lewat Modal.
 */
export default async function PosLayout({ children }: { children: ReactNode }) {
  const session = await getPosSession();

  if (!session) redirect("/pos/masuk");

  return (
    <div className="min-h-dvh lg:flex">
      <SideNav
        kedaiName={session.kedaiName}
        employeeName={session.employeeName}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <PosHeader
          kedaiName={session.kedaiName}
          employeeName={session.employeeName}
        />

        {/*
          pb-20 memberi ruang untuk bottom nav yang fixed. Tanpa ini, item
          terakhir di keranjang atau daftar transaksi tertutup navigasi dan
          kasir tidak bisa menjangkaunya. Di md+ bottom nav hilang, jadi
          ruang bawah cukup untuk padding biasa.

          max-w-lg hanya di layar kecil. Di layar lebar, membatasi isi ke
          512px hanya menyisakan ruang kosong: monitor kasir sudah dipakai
          panel keranjang dan sidebar, ruang sisa jangan dibiarkan menganggur.
        */}
        <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-4 pb-20 lg:max-w-none lg:px-6 lg:pb-6">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
