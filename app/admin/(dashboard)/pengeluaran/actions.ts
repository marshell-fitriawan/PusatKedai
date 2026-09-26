"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type HasilPengeluaran = { error: string | null; ok?: boolean };

const kategori = ["bahan_baku", "listrik", "sewa", "gaji", "lainnya"] as const;

const schemaTambah = z.object({
  kedaiId: z.string().uuid(),
  category: z.enum(kategori),
  description: z
    .string()
    .trim()
    .min(3, "Deskripsi minimal 3 karakter")
    .max(255, "Deskripsi terlalu panjang"),
  amount: z.coerce
    .number({ message: "Jumlah harus berupa angka" })
    .gt(0, "Jumlah harus lebih dari nol")
    .max(999_999_999_999),
  expenseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  shiftId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  fromCash: z.boolean(),
});

const schemaHapus = z.object({ id: z.string().uuid() });

/**
 * Mencatat pengeluaran operasional.
 *
 * `recorded_by_admin_id` diisi dari sesi admin, bukan dari form -- alasan yang
 * sama dengan stok: pencatat harus bisa dipercaya, dan input bisa mengaku.
 * Kategori dibatasi daftar tetap oleh CHECK di database, disamakan di Zod
 * supaya kasir mendapat pesan ramah, bukan error DB.
 *
 * Sejak M8-3 pengeluaran bisa mengikat ke sebuah sesi (shift_id) dan ditandai
 * "ambil dari kas" (from_cash). Uang yang diambil dari laci kas harus tahu
 * sesinya -- reconcile_shift mengurangkannya dari expected_cash sesi itu, dan
 * constraint DB menolak from_cash tanpa shift_id.
 */
export async function tambahPengeluaran(
  kedaiId: string,
  category: (typeof kategori)[number],
  description: string,
  amount: number,
  expenseDate: string,
  shiftId: string,
  fromCash: boolean,
): Promise<HasilPengeluaran> {
  const admin = await requireAdmin();

  const parsed = schemaTambah.safeParse({
    kedaiId,
    category,
    description,
    amount,
    expenseDate,
    shiftId,
    fromCash,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  if (parsed.data.fromCash && !parsed.data.shiftId) {
    return { error: "Pengeluaran dari kas wajib memilih sesi yang sedang buka." };
  }

  const db = createAdminClient();

  // Kalau dikaitkan ke sesi, sesi itu harus milik kedai yang dipilih -- jangan
  // biarkan pencatatan "dari kas" menempel di sesi kedai lain.
  if (parsed.data.shiftId) {
    const { data: shift } = await db
      .from("shifts")
      .select("kedai_id, status")
      .eq("id", parsed.data.shiftId)
      .maybeSingle();
    if (!shift || shift.kedai_id !== parsed.data.kedaiId) {
      return { error: "Sesi tidak cocok dengan kedai yang dipilih." };
    }
  }

  const { error } = await db.from("expenses").insert({
    kedai_id: parsed.data.kedaiId,
    category: parsed.data.category,
    description: parsed.data.description,
    amount: parsed.data.amount,
    expense_date: parsed.data.expenseDate,
    recorded_by_admin_id: admin.id,
    shift_id: parsed.data.shiftId ?? null,
    from_cash: parsed.data.fromCash && parsed.data.shiftId
      ? true
      : false,
  });

  if (error) return { error: `Gagal menyimpan pengeluaran: ${error.message}` };

  revalidatePath("/admin/pengeluaran");
  revalidatePath("/admin/laporan/laba-rugi");
  return { error: null, ok: true };
}

/**
 * Menghapus pengeluaran yang salah masuk.
 *
 * Karena jumlah pengeluaran TIDAK menyentuh ledger stok (tidak seperti
 * transaksi), kesalahan input bisa diperbaiki dengan hapus saja -- tidak ada
 * jejak yang perlu dibalik. Fungsi ini admin-only.
 */
export async function hapusPengeluaran(id: string): Promise<HasilPengeluaran> {
  await requireAdmin();

  if (!schemaHapus.safeParse({ id }).success) {
    return { error: "Data tidak valid." };
  }

  const db = createAdminClient();

  const { error } = await db.from("expenses").delete().eq("id", id);

  if (error) return { error: `Gagal menghapus pengeluaran: ${error.message}` };

  revalidatePath("/admin/pengeluaran");
  revalidatePath("/admin/laporan/laba-rugi");
  return { error: null, ok: true };
}