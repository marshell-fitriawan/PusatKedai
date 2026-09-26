"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type HasilMutasi = { error: string | null };

const schemaTolak = z.object({
  mutationId: z.string().uuid(),
  alasan: z
    .string()
    .trim()
    .min(3, "Alasan penolakan minimal 3 karakter")
    .max(255, "Alasan terlalu panjang"),
});

/**
 * Menyetujui mutasi: stok pindah SEJARANG juga.
 *
 * Menyuruh fungsi database `approve_mutation` (migration 0009) mengeksekusi
 * perpindahan -- persetujuan dan pergerakan stok adalah satu transaksi atomik,
 * jadi admin tidak bisa menyetujui tanpa stok benar-benar pindah.
 *
 * Memakai admin client karena fungsi hanya boleh dipanggil service_role
 * (izimnya dicabut dari anon/authenticated).
 */
export async function setujuiMutasi(mutationId: string): Promise<HasilMutasi> {
  const admin = await requireAdmin();

  if (!z.string().uuid().safeParse(mutationId).success) {
    return { error: "Data tidak valid." };
  }

  const db = createAdminClient();

  const { data, error } = await db.rpc("approve_mutation", {
    p_mutation_id: mutationId,
    p_admin_id: admin.id,
  });

  if (error) {
    // Pesan dari raise exception di DB (mis. stok asal tidak cukup) langsung
    // diteruskan -- kasir kedai asal dan admin butuh tahu kenapa ditolak.
    return { error: `Gagal menyetujui: ${error.message}` };
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return { error: "Mutasi tidak ditemukan." };
  }

  revalidatePath("/admin/mutasi");
  return { error: null };
}

/**
 * Menolak mutasi. Hanya mutasi yang masih `pending` yang boleh ditolak --
 * menyetujui lalu menolak ulang artinya mengubah jejak audit.
 */
export async function tolakMutasi(
  mutationId: string,
  alasan: string,
): Promise<HasilMutasi> {
  await requireAdmin();

  const parsed = schemaTolak.safeParse({ mutationId, alasan });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const db = createAdminClient();

  const { data: baris } = await db
    .from("stock_mutations")
    .select("status")
    .eq("id", parsed.data.mutationId)
    .maybeSingle();

  if (!baris) return { error: "Mutasi tidak ditemukan." };
  if (baris.status !== "pending") {
    return { error: `Mutasi ini sudah berstatus ${baris.status}, tidak bisa ditolak lagi.` };
  }

  const { error } = await db
    .from("stock_mutations")
    .update({ status: "rejected", note: parsed.data.alasan })
    .eq("id", parsed.data.mutationId)
    .eq("status", "pending");

  if (error) return { error: `Gagal menolak mutasi: ${error.message}` };

  revalidatePath("/admin/mutasi");
  return { error: null };
}

const schemaAssign = z.object({
  fromKedaiId: z.string().uuid(),
  toKedaiId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.coerce
    .number({ message: "Jumlah harus berupa angka" })
    .int("Jumlah harus bilangan bulat")
    .min(1, "Jumlah harus lebih dari nol")
    .max(999_999, "Jumlah terlalu besar"),
});

/**
 * Assign stok jadi dari GUDANG pusat ke kedai (M6-5).
 *
 * Pemilik mengirim stok dari warehouse ke kedai: mutasi dibuat sebagai
 * pending oleh admin, lalu LANGSUNG dieksekusi lewat approve_mutation --
 * tidak menunggu persetujuan karena pemiliknya sendiri yang menyetujui.
 * Sama seperti approve, seluruh perpindahan atomik + idempoten.
 */
export async function assignDariGudang(
  fromKedaiId: string,
  toKedaiId: string,
  productId: string,
  quantity: number,
): Promise<HasilMutasi> {
  const admin = await requireAdmin();

  const parsed = schemaAssign.safeParse({
    fromKedaiId,
    toKedaiId,
    productId,
    quantity,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  if (fromKedaiId === toKedaiId) {
    return { error: "Gudang dan tujuan tidak boleh sama." };
  }

  const db = createAdminClient();

  // Hanya gudang pusat yang boleh menjadi asal assign.
  const { data: asal } = await db
    .from("kedai")
    .select("is_warehouse")
    .eq("id", parsed.data.fromKedaiId)
    .maybeSingle();
  if (!asal) return { error: "Kedai asal tidak ditemukan." };
  if (!asal.is_warehouse) {
    return { error: "Asal assign harus gudang pusat." };
  }

  const { data: mutasi, error: errInsert } = await db
    .from("stock_mutations")
    .insert({
      from_kedai_id: parsed.data.fromKedaiId,
      to_kedai_id: parsed.data.toKedaiId,
      product_id: parsed.data.productId,
      quantity: parsed.data.quantity,
      status: "pending",
      requested_by_admin_id: admin.id,
      note: "Assign stok dari gudang pusat",
    })
    .select("id")
    .single();

  if (errInsert) {
    return { error: `Gagal membuat mutasi: ${errInsert.message}` };
  }

  const { error } = await db.rpc("approve_mutation", {
    p_mutation_id: mutasi.id,
    p_admin_id: admin.id,
  });

  if (error) {
    // Gagal (mis. stok gudang tidak cukup): batalkan, jangan biarkan mutasi
    // pending menggantung yang hanya bisa dieksekusi lewat approve.
    await db
      .from("stock_mutations")
      .update({ status: "rejected", note: `Gagal assign: ${error.message}` })
      .eq("id", mutasi.id)
      .eq("status", "pending");

    return { error: `Gagal assign: ${error.message}` };
  }

  revalidatePath("/admin/mutasi");
  revalidatePath("/admin/stok");
  return { error: null };
}