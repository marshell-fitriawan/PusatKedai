"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { CloudOff, CloudUpload, RefreshCw, TriangleAlert } from "lucide-react";
import { db } from "@/lib/offline/db";
import { cobaUlangError, syncAntrian } from "@/lib/offline/sync-queue";
import { cn } from "@/lib/utils";

/**
 * Indikator status antrian (M2-6).
 *
 * Kasir harus bisa tahu sekilas apakah penjualannya sudah aman di server.
 * Tanpa ini, satu-satunya cara mengetahuinya adalah menutup toko dan
 * menemukan selisih kas -- terlambat.
 *
 * Komponen ini juga yang memicu sync: saat dimuat, saat koneksi kembali,
 * dan setiap 30 detik. Tidak memakai Background Sync API service worker --
 * dukungannya masih tidak merata, dan pemicu eksplisit jauh lebih mudah
 * ditelusuri saat ada laporan "transaksi saya belum masuk".
 *
 * TIDAK ADA state hitungan di sini. Semuanya turunan dari isi IndexedDB
 * lewat useLiveQuery, jadi angka di layar tidak akan pernah berbeda dengan
 * isi antrian yang sebenarnya.
 */

function langgananOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function SyncStatus({ kedaiId }: { kedaiId: string }) {
  const router = useRouter();

  const antrian = useLiveQuery(
    () => db.antrian.where("kedaiId").equals(kedaiId).toArray(),
    [kedaiId],
    [],
  );

  const online = useSyncExternalStore(
    langgananOnline,
    () => navigator.onLine,
    // Snapshot saat render di server: anggap online, supaya HTML awal tidak
    // menampilkan peringatan offline yang langsung hilang.
    () => true,
  );

  const bermasalah = antrian.filter((t) => t.status === "error").length;
  const tertunda = antrian.length - bermasalah;
  const mengirim = antrian.some((t) => t.status === "sending");

  const jalankanSync = useCallback(async () => {
    if (!navigator.onLine) return;

    const hasil = await syncAntrian(kedaiId);
    // Stok di server berubah setelah antrian masuk, jadi halaman perlu
    // diambil ulang -- kalau tidak, grid menampilkan stok sebelum sync.
    if (hasil.terkirim > 0) router.refresh();
  }, [kedaiId, router]);

  // Koneksi kembali -> langsung coba kirim.
  useEffect(() => {
    if (online) void jalankanSync();
  }, [online, jalankanSync]);

  // Jaring pengaman: event `online` hanya terpicu saat antarmuka jaringan
  // berubah, bukan saat sinyal lemah pulih dengan sendirinya.
  useEffect(() => {
    const timer = setInterval(() => void jalankanSync(), 30_000);
    return () => clearInterval(timer);
  }, [jalankanSync]);

  if (antrian.length === 0 && online) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 border-2 border-ink p-2",
        "font-display text-xs font-bold uppercase tracking-tight",
        bermasalah > 0
          ? "bg-danger text-ink"
          : !online
            ? "bg-warning text-ink"
            : "bg-info text-white",
      )}
      role="status"
    >
      {bermasalah > 0 ? (
        <TriangleAlert className="size-4 shrink-0" aria-hidden />
      ) : !online ? (
        <CloudOff className="size-4 shrink-0" aria-hidden />
      ) : (
        <CloudUpload
          className={cn("size-4 shrink-0", mengirim && "animate-pulse")}
          aria-hidden
        />
      )}

      <span className="flex-1">
        {bermasalah > 0
          ? `${bermasalah} transaksi gagal terkirim`
          : !online
            ? tertunda > 0
              ? `Mode offline — ${tertunda} transaksi menunggu`
              : "Mode offline — penjualan tetap bisa dicatat"
            : mengirim
              ? `Mengirim ${tertunda} transaksi...`
              : `${tertunda} transaksi belum tersinkron`}
      </span>

      {bermasalah > 0 ? (
        <button
          type="button"
          onClick={async () => {
            await cobaUlangError(kedaiId);
            router.refresh();
          }}
          className="flex items-center gap-1 underline"
        >
          <RefreshCw className="size-3" aria-hidden />
          Coba lagi
        </button>
      ) : null}
    </div>
  );
}
