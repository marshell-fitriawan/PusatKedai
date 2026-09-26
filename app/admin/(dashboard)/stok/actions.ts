"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type HasilStok = {
  error: string | null;
  quantity?: number;
  delta?: number;
};

const schema = z.object({
  kedaiId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.coerce
    .number({ message: "Jumlah harus berupa angka" })
    .int("Jumlah harus bilangan bulat")
    // Boleh negatif: stok minus memang diizinkan (docs/Database.md §7), dan
    // admin harus bisa mencatat kondisi sebenarnya, termasuk yang minus.
    .min(-999_999)
    .max(999_999),
  note: z
    .string()
    .trim()
    .min(3, "Alasan minimal 3 karakter")
    .max(255, "Alasan terlalu panjang"),
});

/**
 * Menyetel stok sebuah produk di sebuah kedai.
 *
 * Memakai fungsi database `adjust_stock`, bukan UPDATE langsung: saldo dan
 * ledger wajib berubah bersama. Lihat alasannya di migration 0007.
 *
 * Memakai admin client karena fungsi itu dicabut izinnya dari anon dan
 * authenticated -- hanya service_role yang boleh memanggil.
 */
export async function setStok(
  kedaiId: string,
  productId: string,
  quantity: number,
  note: string,
): Promise<HasilStok> {
  const admin = await requireAdmin();

  const parsed = schema.safeParse({ kedaiId, productId, quantity, note });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const db = createAdminClient();

  const { data, error } = await db.rpc("adjust_stock", {
    p_kedai_id: parsed.data.kedaiId,
    p_product_id: parsed.data.productId,
    p_new_quantity: parsed.data.quantity,
    p_note: parsed.data.note,
    // Pencatat diambil dari sesi admin, bukan dari input.
    p_admin_id: admin.id,
  });

  if (error) return { error: `Gagal menyimpan stok: ${error.message}` };

  const hasil = Array.isArray(data) ? data[0] : data;

  revalidatePath("/admin/stok");
  return {
    error: null,
    quantity: hasil?.quantity ?? quantity,
    delta: hasil?.delta ?? 0,
  };
}

export type BarisRiwayat = {
  created_at: string;
  delta: number;
  balance_after: number;
  reason: string;
  note: string | null;
};

/** Riwayat pergerakan stok satu produk di satu kedai (M4-2c). */
export async function riwayatStok(
  kedaiId: string,
  productId: string,
): Promise<{ error: string | null; data?: BarisRiwayat[] }> {
  await requireAdmin();

  const db = createAdminClient();

  const { data, error } = await db
    .from("stock_movements")
    .select("created_at, delta, balance_after, reason, note")
    .eq("kedai_id", kedaiId)
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return { error: error.message };
  return { error: null, data: data ?? [] };
}
