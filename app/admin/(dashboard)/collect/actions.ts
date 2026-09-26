"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  shiftId: z.string().uuid(),
  status: z.enum(["terbuka", "dijelaskan", "rugi"]),
  note: z
    .string()
    .trim()
    .max(500, "Catatan terlalu panjang")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/**
 * Menyelesaikan status selisih sebuah shift (M7-5):
 *  - dijelaskan: selisih wajar / sudah dijelaskan, ditutup dengan catatan
 *  - rugi:       dicatat sebagai rugi (mis. kas kurang karena salah kasih)
 * Catatan menjadi jejak keputusan pemilik.{""}
 */
export async function setStatusSelisih(
  shiftId: string,
  status: "terbuka" | "dijelaskan" | "rugi",
  note: string,
): Promise<{ error: string | null }> {
  await requireAdmin();

  const parsed = schema.safeParse({ shiftId, status, note });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const db = createAdminClient();

  const { data: shift } = await db
    .from("shifts")
    .select("reconciliation_status, business_date, kedai_id, cash_difference")
    .eq("id", parsed.data.shiftId)
    .maybeSingle();

  if (!shift) return { error: "Shift tidak ditemukan." };
  if (shift.reconciliation_status !== "final") {
    return { error: "Penutupan ini belum bisa diselesaikan — datanya belum lengkap." };
  }

  const { error } = await db
    .from("shifts")
    .update({
      difference_status: parsed.data.status,
      difference_note: parsed.data.note ?? null,
    })
    .eq("id", parsed.data.shiftId);

  if (error) return { error: `Gagal menyimpan status: ${error.message}` };

  // Kuputusan "rugi" dikunci jadi jejak tersendiri (M7-6).
  if (parsed.data.status === "rugi") {
    await db.from("notifikasi").insert({
      kedai_id: shift.kedai_id,
      shift_id: parsed.data.shiftId,
      type: "selisih",
      title: "Selisih dicatat sebagai rugi",
      message: `Shift ${shift.business_date} ditutup dengan selisih tercatat rugi.`,
    });
  }

  revalidatePath("/admin/collect");
  return { error: null };
}