/**
 * Konstanta dan helper murni untuk gambar produk.
 *
 * File ini SENGAJA tidak mengimpor client Supabase apa pun, supaya bisa
 * dipakai bersama oleh komponen browser maupun server action. Fungsi yang
 * benar-benar mengunggah ada di `lib/storage-client.ts` (browser saja).
 */

export const PRODUK_BUCKET = "produk";

/** Sama dengan allowed_mime_types di 0003_storage_produk.sql. */
export const GAMBAR_MIME = ["image/jpeg", "image/png", "image/webp"];

/** Sama dengan file_size_limit bucket: 2 MB. */
export const GAMBAR_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Ambil path objek dari URL publik, atau null kalau bukan URL bucket ini.
 *
 * Dipakai untuk menghapus gambar lama saat diganti, supaya tidak menumpuk
 * file yatim yang tetap memakan kuota Storage. Pemeriksaan penanda juga
 * mencegah kita mencoba menghapus berdasarkan URL sembarangan.
 */
export function pathDariUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const penanda = `/storage/v1/object/public/${PRODUK_BUCKET}/`;
  const i = url.indexOf(penanda);
  return i === -1 ? null : url.slice(i + penanda.length);
}
