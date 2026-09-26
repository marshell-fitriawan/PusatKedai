import { createClient } from "@/lib/supabase/client";
import {
  GAMBAR_MAX_BYTES,
  GAMBAR_MIME,
  PRODUK_BUCKET,
  pathDariUrl,
} from "@/lib/storage";

/**
 * Unggah gambar produk LANGSUNG dari browser ke Supabase Storage.
 *
 * Tidak lewat server action karena Next membatasi body request action ke 1MB
 * secara bawaan, dan foto dari kamera HP gampang menembusnya. Menaikkan batas
 * itu berarti seluruh byte gambar melewati server Next lebih dulu -- lambat
 * dan mahal, padahal tujuannya cuma menaruh file di Storage.
 *
 * Yang dikirim ke server action hanyalah URL hasilnya.
 *
 * Izin unggah ditegakkan policy Storage (0003_storage_produk.sql): hanya
 * admin aktif yang boleh menulis ke bucket ini. Pemeriksaan ukuran dan tipe
 * di bawah cuma supaya pesan errornya ramah -- penegak sebenarnya tetap
 * bucket, karena kode browser bisa dilewati.
 */
export async function unggahGambarProduk(file: File): Promise<string> {
  if (!GAMBAR_MIME.includes(file.type)) {
    throw new Error("Format gambar harus JPG, PNG, atau WebP.");
  }

  if (file.size > GAMBAR_MAX_BYTES) {
    throw new Error("Ukuran gambar maksimal 2 MB.");
  }

  const supabase = createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  // Nama acak: mencegah tabrakan sekaligus menghindari nama file asli yang
  // bisa memuat karakter aneh atau informasi yang tidak perlu dipublikasikan.
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(PRODUK_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    throw new Error(`Gagal mengunggah gambar: ${error.message}`);
  }

  return supabase.storage.from(PRODUK_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Hapus gambar yang sudah terlanjur diunggah tapi batal dipakai -- mis. user
 * mengganti pilihan gambar sebelum menekan Simpan.
 *
 * Kegagalan hapus sengaja diabaikan: file yatim jauh lebih ringan akibatnya
 * daripada alur pengisian form yang terganggu.
 */
export async function hapusGambarProduk(url: string | null): Promise<void> {
  const path = pathDariUrl(url);
  if (!path) return;

  const supabase = createClient();
  await supabase.storage.from(PRODUK_BUCKET).remove([path]);
}
