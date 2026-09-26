"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type HasilProduksi = {
  error: string | null;
  qty_hasil?: number;
  produced_at?: string;
};

const schema = z.object({
  productId: z.string().uuid(),
  qtyHasil: z.coerce
    .number({ message: "Jumlah hasil harus berupa angka" })
    .int("Jumlah hasil harus bilangan bulat")
    .min(1, "Jumlah hasil harus lebih dari nol")
    .max(999_999, "Jumlah hasil terlalu besar"),
  bahanIds: z.array(z.string().uuid()).min(1, "Pilih minimal satu bahan"),
  qtyPakai: z.array(
    z.coerce
      .number({ message: "Pemakaian harus berupa angka" })
      .int("Pemakaian harus bilangan bulat")
      .min(1, "Pemakaian harus lebih dari nol")
      .max(999_999, "Pemakaian terlalu besar"),
  ),
  note: z.string().trim().max(255, "Catatan terlalu panjang").optional(),
});

/**
 * Mencatat satu run produksi: banyak bahan -> satu produk jadi di gudang
 * pusat. Satu DB transaction (fungsi record_produksi): bahan dicek cukup lalu
 * dikurangi, hasil masuk kedai_stock gudang disertai ledger. Idempoten per
 * p_id -- dipanggil ulang tidak menggandakan stok.
 */
export async function catatProduksi(
  productId: string,
  qtyHasil: number,
  bahanIds: string[],
  qtyPakai: number[],
  note: string,
): Promise<HasilProduksi> {
  const admin = await requireAdmin();

  const parsed = schema.safeParse({
    productId,
    qtyHasil,
    bahanIds,
    qtyPakai,
    note,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  if (parsed.data.bahanIds.length !== parsed.data.qtyPakai.length) {
    return { error: "Jumlah bahan dan pemakaian tidak cocok." };
  }

  const db = createAdminClient();
  const { data, error } = await db.rpc("record_produksi", {
    p_id: randomUUID(),
    p_product_id: parsed.data.productId,
    p_qty_hasil: parsed.data.qtyHasil,
    p_bahan_ids: parsed.data.bahanIds,
    p_qty_pakai: parsed.data.qtyPakai,
    p_admin_id: admin.id,
    p_note: parsed.data.note || "",
  });

  // Pesan dari raise exception di DB (mis. stok bahan tidak cukup) diteruskan
  // apa adanya -- pemilik perlu tahu penyebab aslinya.
  if (error) return { error: `Gagal mencatat produksi: ${error.message}` };

  const hasil = Array.isArray(data) ? data[0] : data;

  revalidatePath("/admin/produksi");
  revalidatePath("/admin/stok");
  revalidatePath("/admin/bahan");
  return {
    error: null,
    qty_hasil: hasil?.qty_hasil ?? qtyHasil,
    produced_at: hasil?.produced_at,
  };
}