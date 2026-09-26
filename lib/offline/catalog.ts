import { db, type ProdukCache } from "@/lib/offline/db";
import type { ProdukKasir } from "@/lib/pos/cart";

/**
 * Menyimpan katalog + stok ke perangkat (M2-2).
 *
 * Dipanggil setiap kali halaman kasir dimuat dalam keadaan online. Datanya
 * ditimpa seluruhnya, bukan digabung: produk yang dinonaktifkan admin harus
 * ikut hilang dari perangkat, dan penggabungan akan menyisakannya.
 *
 * Cache ini SENGAJA per kedai. Satu perangkat bisa berpindah kedai antar
 * shift, dan stok kedai lama tidak boleh ikut terbawa.
 */
export async function simpanKatalog(kedaiId: string, produk: ProdukKasir[]) {
  const baris: ProdukCache[] = produk.map((p) => ({
    key: `${kedaiId}:${p.id}`,
    kedaiId,
    id: p.id,
    name: p.name,
    price: p.price,
    category: p.category,
    image_url: p.image_url,
    stok: p.stok,
  }));

  await db.transaction("rw", db.produk, db.meta, async () => {
    await db.produk.where("kedaiId").equals(kedaiId).delete();
    await db.produk.bulkPut(baris);
    await db.meta.put({
      key: `katalog:${kedaiId}`,
      value: new Date().toISOString(),
    });
  });
}

/**
 * Membaca katalog dari perangkat, untuk dipakai saat offline.
 *
 * PERINGATAN: stok di sini adalah angka saat terakhir online. Ia bisa sudah
 * basi -- kasir lain di kedai yang sama mungkin sudah menjual barangnya.
 * Itu sebabnya stok tidak pernah dijadikan penghalang penjualan; lihat
 * docs/Database.md §7.
 */
export async function bacaKatalog(kedaiId: string): Promise<ProdukKasir[]> {
  const baris = await db.produk.where("kedaiId").equals(kedaiId).toArray();

  return baris.map((b) => ({
    id: b.id,
    name: b.name,
    price: b.price,
    category: b.category,
    image_url: b.image_url,
    stok: b.stok,
  }));
}

/** Kapan katalog terakhir disegarkan, atau null kalau belum pernah. */
export async function katalogTerakhir(kedaiId: string): Promise<Date | null> {
  const m = await db.meta.get(`katalog:${kedaiId}`);
  return m ? new Date(m.value) : null;
}
