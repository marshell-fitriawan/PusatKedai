import Dexie, { type EntityTable } from "dexie";

/**
 * Penyimpanan lokal di perangkat kasir (IndexedDB lewat Dexie).
 *
 * KENAPA INDEXEDDB, BUKAN localStorage
 * localStorage dibatasi ~5MB, hanya menyimpan string, dan operasinya
 * MEMBLOKIR thread utama. Untuk antrian transaksi yang ditulis di tengah
 * pelayanan pelanggan, jeda sekecil apa pun terasa. IndexedDB asinkron,
 * berkapasitas jauh lebih besar, dan bisa diindeks.
 *
 * KENAPA BUKAN CACHE SERVICE WORKER
 * Cache service worker untuk respons HTTP, bukan data yang harus bertahan
 * dan diubah. Antrian transaksi harus selamat dari restart browser dan
 * bisa ditandai statusnya satu per satu.
 */

export type StatusAntrian = "pending" | "sending" | "error";

export type ItemTransaksi = {
  product_id: string;
  name: string;
  price: number;
  qty: number;
};

export type TransaksiTertunda = {
  /** UUID yang dibuat perangkat. Kunci idempotensi ke server. */
  id: string;
  kedaiId: string;
  /**
   * Shift saat penjualan TERJADI -- bukan shift yang sedang terbuka saat
   * antrian dikirim. Transaksi yang dibuat sebelum toko tutup harus tetap
   * masuk ke shift lamanya, kalau tidak rekonsiliasi kas dua shift sekaligus
   * jadi salah.
   */
  shiftId: string;
  localNumber: string;
  deviceId: string;
  createdAt: string;
  items: ItemTransaksi[];
  total: number;
  status: StatusAntrian;
  /** Berapa kali sudah dicoba kirim. Dipakai untuk backoff. */
  attempts: number;
  lastError?: string;
  /** Nomor final dari server, terisi setelah sync berhasil. */
  transactionNumber?: string;
};

export type ProdukCache = {
  /** `${kedaiId}:${productId}` -- satu produk bisa beda stok antar kedai. */
  key: string;
  kedaiId: string;
  id: string;
  name: string;
  price: number;
  category: string | null;
  image_url: string | null;
  stok: number;
};

export type Meta = {
  key: string;
  value: string;
};

const db = new Dexie("multi-kedai") as Dexie & {
  antrian: EntityTable<TransaksiTertunda, "id">;
  produk: EntityTable<ProdukCache, "key">;
  meta: EntityTable<Meta, "key">;
};

// Versi 1. Menambah/mengubah indeks WAJIB menaikkan nomor versi dan
// menambahkan blok .version() baru -- perangkat kasir yang sudah dipakai
// masih menyimpan skema lama, dan Dexie memigrasikannya berdasarkan ini.
db.version(1).stores({
  antrian: "id, status, createdAt, kedaiId",
  produk: "key, kedaiId",
  meta: "key",
});

export { db };

/** Transaksi yang belum sampai server, urut dari yang paling lama. */
export function transaksiTertunda(kedaiId: string) {
  return db.antrian
    .where("kedaiId")
    .equals(kedaiId)
    .filter((t) => t.status !== "sending")
    .sortBy("createdAt");
}

export async function jumlahTertunda(kedaiId: string): Promise<number> {
  return db.antrian.where("kedaiId").equals(kedaiId).count();
}
