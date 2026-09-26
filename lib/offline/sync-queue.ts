import { db, type TransaksiTertunda } from "@/lib/offline/db";
import type { HasilSyncItem } from "@/app/api/sync/transactions/route";

/**
 * Pengirim antrian transaksi offline (M2-5).
 *
 * Aturan yang menjaga data tidak hilang atau dobel:
 *
 * 1. Item dihapus dari antrian HANYA setelah server mengonfirmasi. Kalau
 *    koneksi putus tepat setelah server menyimpan tapi sebelum responsnya
 *    sampai, item itu tetap di antrian dan dikirim lagi -- dan server
 *    mengembalikan nomor yang sama karena idempoten. Lebih baik mengirim
 *    dua kali daripada menghapus sesuatu yang belum tentu tersimpan.
 *
 * 2. Hanya satu proses sync berjalan pada satu waktu. Dua proses paralel
 *    akan mengirim item yang sama bersamaan -- tetap aman berkat
 *    idempotensi, tapi membuang kuota dan membingungkan penghitung status.
 *
 * 3. Kegagalan permanen (data ditolak constraint) TIDAK dicoba ulang
 *    selamanya. Ia ditandai `error` supaya muncul di UI dan bisa ditangani
 *    manusia, bukan berputar diam-diam.
 */

const BATAS_BATCH = 20;

/** Mencegah dua proses sync berjalan bersamaan dalam satu tab. */
let sedangBerjalan = false;

export type RingkasanSync = {
  terkirim: number;
  gagal: number;
  tersisa: number;
  /** Hasil per transaksi -- dipakai layar kasir untuk mengambil nomor final. */
  hasil: HasilSyncItem[];
};

export async function syncAntrian(kedaiId: string): Promise<RingkasanSync> {
  if (sedangBerjalan || !navigator.onLine) {
    return { terkirim: 0, gagal: 0, tersisa: await db.antrian.count(), hasil: [] };
  }

  sedangBerjalan = true;

  try {
    const antrian = await db.antrian
      .where("kedaiId")
      .equals(kedaiId)
      .filter((t) => t.status === "pending")
      .limit(BATAS_BATCH)
      .toArray();

    if (antrian.length === 0) {
      return { terkirim: 0, gagal: 0, tersisa: await db.antrian.count(), hasil: [] };
    }

    await db.antrian.bulkUpdate(
      antrian.map((t) => ({ key: t.id, changes: { status: "sending" as const } })),
    );

    let response: Response;

    try {
      response = await fetch("/api/sync/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: antrian.map((t) => ({
            id: t.id,
            // Shift saat penjualan terjadi, bukan yang sedang terbuka.
            shiftId: t.shiftId,
            localNumber: t.localNumber,
            deviceId: t.deviceId,
            createdAt: t.createdAt,
            items: t.items,
          })),
        }),
      });
    } catch {
      // Jaringan putus di tengah kirim. Kembalikan ke pending supaya dicoba
      // lagi -- JANGAN ditandai error, tidak ada yang salah dengan datanya.
      await kembalikanKePending(antrian);
      return { terkirim: 0, gagal: 0, tersisa: await db.antrian.count(), hasil: [] };
    }

    if (!response.ok) {
      // 409 = tidak ada shift terbuka. Antrian ditahan, bukan dibuang:
      // begitu toko dibuka lagi, transaksinya menyusul.
      await kembalikanKePending(antrian);
      return { terkirim: 0, gagal: 0, tersisa: await db.antrian.count(), hasil: [] };
    }

    const { hasil } = (await response.json()) as { hasil: HasilSyncItem[] };

    let terkirim = 0;
    let gagal = 0;

    for (const item of hasil) {
      if (item.ok) {
        await db.antrian.delete(item.id);
        terkirim++;
        continue;
      }

      gagal++;

      await db.antrian.update(item.id, {
        // Permanen -> berhenti dicoba, tampil di UI sebagai perlu perhatian.
        // Sementara -> kembali antre.
        status: item.permanen ? "error" : "pending",
        lastError: item.error,
      });
    }

    // Sisa item yang tidak disebut server (mis. respons terpotong)
    // dikembalikan ke pending, bukan dianggap terkirim.
    const disebut = new Set(hasil.map((h) => h.id));
    await kembalikanKePending(antrian.filter((t) => !disebut.has(t.id)));

    return { terkirim, gagal, tersisa: await db.antrian.count(), hasil };
  } finally {
    sedangBerjalan = false;
  }
}

async function kembalikanKePending(items: TransaksiTertunda[]) {
  if (items.length === 0) return;

  await db.antrian.bulkUpdate(
    items.map((t) => ({
      key: t.id,
      changes: { status: "pending" as const, attempts: t.attempts + 1 },
    })),
  );
}

/** Coba ulang item yang sebelumnya ditandai gagal permanen. */
export async function cobaUlangError(kedaiId: string) {
  const error = await db.antrian
    .where("kedaiId")
    .equals(kedaiId)
    .filter((t) => t.status === "error")
    .toArray();

  await db.antrian.bulkUpdate(
    error.map((t) => ({ key: t.id, changes: { status: "pending" as const } })),
  );

  return syncAntrian(kedaiId);
}
