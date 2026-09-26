"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPosSession } from "@/lib/pos/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type HasilMutasi = { error: string | null; ok?: boolean };

const schema = z.object({
  productId: z.string().uuid(),
  toKedaiId: z.string().uuid(),
  quantity: z.coerce
    .number({ message: "Jumlah harus berupa angka" })
    .int("Jumlah harus bilangan bulat")
    .min(1, "Jumlah minimal 1")
    .max(999_999),
  note: z.string().trim().max(255, "Catatan terlalu panjang"),
});

/**
 * Mengajukan pindah stok dari kedai ini ke kedai lain.
 *
 * `from_kedai_id` berasal dari sesi, bukan input -- kasir tidak bisa
 * mengarahkan mutasi ke kedai lain atas nama kedainya. Status awal selalu
 * `pending` dan menunggu persetujuan admin pusat (approve_mutation).
 *
 * Stok tersedia diperiksa SUPPLY: kasir boleh mengajukan lebih dari stok
 * terkini karena barang bisa dibeli sebelum persetujuan rampung. Admin yang
 * akan memutuskan saat execute, dan akan ditolak kalau saat itu stok tidak
 * cukup -- dicegah di database, bukan di form.
 */
export async function ajukanMutasi(
  productId: string,
  toKedaiId: string,
  quantity: number,
  note = "",
): Promise<HasilMutasi> {
  const session = await getPosSession();
  if (!session) return { error: "Sesi kasir berakhir. Pindai kartu lagi." };

  const parsed = schema.safeParse({ productId, toKedaiId, quantity, note });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  if (parsed.data.toKedaiId === session.kedaiId) {
    return { error: "Kedai tujuan tidak boleh sama dengan kedai ini." };
  }

  const db = createAdminClient();

  const { data: stok } = await db
    .from("kedai_stock")
    .select("quantity, products!inner(name)")
    .eq("kedai_id", session.kedaiId)
    .eq("product_id", parsed.data.productId)
    .maybeSingle();

  if (!stok) {
    return { error: "Produk ini tidak terdaftar di stok kedai ini." };
  }

  // Cegah pengajuan kebetulan: kalau saldo saat ini jelas menipis, kasir
  // langsung diberi tahu sekarang, bukan menunggu ditolak admin nanti.
  if (stok.quantity < parsed.data.quantity) {
    return {
      error: `Stok saat ini hanya ${stok.quantity}. Persetujuan nanti akan ditolak bila tidak sempat ditambah.`,
    };
  }

  const { error } = await db.from("stock_mutations").insert({
    from_kedai_id: session.kedaiId,
    to_kedai_id: parsed.data.toKedaiId,
    product_id: parsed.data.productId,
    quantity: parsed.data.quantity,
    requested_by_employee_id: session.employeeId,
    note: parsed.data.note || null,
  });

  if (error) {
    return { error: `Gagal mengajukan mutasi: ${error.message}` };
  }

  // Kasir mengajukan pengembalian/pindah stok -> pemilik perlu memutuskan
  // (M8-2). Sebelumnya tidak ada pemberitahuan, mutasi menganggur tanpa
  // sepengetahuan siapa pun. Selalu `assign`: persetujuan admin berikutnya
  // (approve_mutation) yang memindahkan stok via ledger.
  const kedai = await db
    .from("kedai")
    .select("name")
    .eq("id", session.kedaiId)
    .maybeSingle();
  const stokAs = stok as unknown as {
    products?: { name: string };
    quantity: number;
  };
  await db.from("notifikasi").insert({
    kedai_id: session.kedaiId,
    type: "assign",
    title: `Mutasi stok menunggu persetujuan — ${kedai.data?.name ?? "kedai"}`,
    message: `${stokAs.products?.name ?? "Produk"} × ${parsed.data.quantity} diajukan lintas kedai.`,
  });

  revalidatePath("/pos/stok");
  return { error: null, ok: true };
}