"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { PRODUK_BUCKET, pathDariUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export type FormState = {
  error: string | null;
  ok?: boolean;
  fieldErrors?: Record<string, string>;
};

/**
 * Validasi di server. Form di browser boleh dilewati sama sekali -- server
 * action punya endpoint sendiri dan bisa dipanggil langsung.
 *
 * Harga disimpan sebagai numeric(12,2) di database, tapi dibatasi bilangan
 * bulat di sini: harga F&B di Indonesia tidak pernah berkoma, dan angka
 * desimal di layar kasir cuma memperlambat pembacaan.
 */
const produkSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama produk wajib diisi")
    .max(100, "Nama terlalu panjang (maksimal 100 karakter)"),
  price: z.coerce
    .number({ message: "Harga harus berupa angka" })
    .int("Harga harus bilangan bulat")
    .min(0, "Harga tidak boleh negatif")
    .max(99_999_999, "Harga terlalu besar"),
  category: z.string().trim().max(50, "Kategori terlalu panjang").optional(),
  image_url: z
    .string()
    .trim()
    .url("URL gambar tidak valid")
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

function parse(formData: FormData) {
  return produkSchema.safeParse({
    name: formData.get("name"),
    price: formData.get("price"),
    category: formData.get("category") || undefined,
    image_url: formData.get("image_url") || undefined,
  });
}

function toFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    result[key] ??= issue.message;
  }
  return result;
}

export async function createProduk(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: "Periksa kembali isian.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    ...parsed.data,
    category: parsed.data.category ?? null,
    image_url: parsed.data.image_url ?? null,
  });

  if (error) {
    return { error: `Gagal menyimpan produk: ${error.message}` };
  }

  revalidatePath("/admin/produk");
  return { error: null, ok: true };
}

export async function updateProduk(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: "Periksa kembali isian.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();

  // Ambil gambar lama SEBELUM di-update, untuk dibersihkan setelahnya.
  const { data: lama } = await supabase
    .from("products")
    .select("image_url")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("products")
    .update({
      ...parsed.data,
      category: parsed.data.category ?? null,
      image_url: parsed.data.image_url ?? null,
    })
    .eq("id", id);

  if (error) {
    return { error: `Gagal memperbarui produk: ${error.message}` };
  }

  // Gambar lama dihapus hanya SETELAH update berhasil. Kalau dihapus lebih
  // dulu dan update-nya gagal, produk kehilangan gambarnya tanpa ada yang
  // menggantikan.
  const pathLama = pathDariUrl(lama?.image_url);
  if (pathLama && lama?.image_url !== (parsed.data.image_url ?? null)) {
    // Gagal hapus tidak digagalkan ke user: file yatim hanya memakan kuota,
    // sementara perubahan produknya sendiri sudah tersimpan benar.
    await supabase.storage.from(PRODUK_BUCKET).remove([pathLama]);
  }

  revalidatePath("/admin/produk");
  return { error: null, ok: true };
}

/**
 * Menonaktifkan produk, bukan menghapusnya.
 *
 * Produk tetap direferensikan transaction_items, kedai_stock, dan
 * stock_movements. Foreign key-nya memakai `on delete restrict`, jadi
 * database pun menolak penghapusan. Produk nonaktif tidak muncul di kasir
 * tapi riwayat penjualannya tetap utuh.
 */
export async function setProdukActive(id: string, isActive: boolean) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) throw new Error(`Gagal mengubah status produk: ${error.message}`);

  revalidatePath("/admin/produk");
}
