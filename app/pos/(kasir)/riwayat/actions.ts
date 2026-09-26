"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPosSession } from "@/lib/pos/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type HasilAjukanVoid = { error: string | null; nomor?: string };

const schema = z.object({
  id: z.string().uuid(),
  alasan: z
    .string()
    .trim()
    .min(3, "Alasan wajib diisi (minimal 3 karakter)")
    .max(255, "Alasan terlalu panjang"),
});

/**
 * Mengajukan pembatalan transaksi (M8-1).
 *
 * Berbeda dari void lama: kasir TIDAK membatalkan langsung. Status transaksi
 * jadi `perlu_review` dan stok TIDAK dikembalikan sampai pemilik menetapkan
 * keputusan lewat halaman /admin/void (decide_void di 0015). `kedai_id` +
 * `employee_id` diambil dari sesi, bukan input.
 */
export async function ajukanVoid(
  id: string,
  alasan: string,
): Promise<HasilAjukanVoid> {
  const session = await getPosSession();
  if (!session) return { error: "Sesi kasir berakhir. Pindai kartu lagi." };

  const parsed = schema.safeParse({ id, alasan });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const db = createAdminClient();

  const { data, error } = await db.rpc("request_void", {
    p_id: parsed.data.id,
    p_kedai_id: session.kedaiId,
    p_employee_id: session.employeeId,
    p_alasan: parsed.data.alasan,
  });

  if (error) return { error: error.message };

  const hasil = Array.isArray(data) ? data[0] : data;

  // Beri tahu pemilik: ada void yang menunggu keputusan (M7-6 pola sama).
  const kedai = await db
    .from("kedai")
    .select("name")
    .eq("id", session.kedaiId)
    .maybeSingle();
  await db.from("notifikasi").insert({
    kedai_id: session.kedaiId,
    type: "void_review",
    title: `Void menunggu review — ${kedai.data?.name ?? "kedai"}`,
    message: `Transaksi #${
      hasil?.transaction_number ?? "?"
    } diajukan kasir untuk dibatalkan: ${parsed.data.alasan}`,
  });

  revalidatePath("/pos/riwayat");
  revalidatePath("/pos/kasir");

  return {
    error: null,
    nomor: hasil?.transaction_number ?? undefined,
  };
}