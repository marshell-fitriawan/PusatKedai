"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  requestId: z.string().uuid(),
  approve: z.boolean(),
  note: z
    .string()
    .trim()
    .max(500, "Catatan terlalu panjang")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/**
 * Keputusan pemilik atas pengajuan void (M8-1). Memanggil RPC decide_void
 * yang membalikkan stok lewat ledger (reason 'void', created_by = operator
 * ini) saat disetujui, atau mengembalikan transaksi ke completed + menyimpan
 * alasan saat ditolak. Semua pengecekan dilakukan di dalam RPC, termasuk
 * menolak keputusan ganda.
 */
export async function putuskanVoid(
  requestId: string,
  approve: boolean,
  note: string,
): Promise<{ error: string | null }> {
  const operator = await requireAdmin();

  const parsed = schema.safeParse({ requestId, approve, note });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  if (!parsed.data.approve && !parsed.data.note) {
    return { error: "Alasan penolakan wajib diisi." };
  }

  const db = createAdminClient();

  const { error } = await db.rpc("decide_void", {
    p_request_id: parsed.data.requestId,
    p_approve: parsed.data.approve,
    p_decided_by: operator.id,
    p_note: parsed.data.note ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/void");
  return { error: null };
}