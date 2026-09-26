"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  notifId: z.string().uuid(),
  isRead: z.boolean(),
});

export async function tandaiBaca(
  notifId: string,
  isRead: boolean,
): Promise<{ error: string | null }> {
  await requireAdmin();

  const parsed = schema.safeParse({ notifId, isRead });
  if (!parsed.success) return { error: "Data tidak valid." };

  const db = createAdminClient();
  const { error } = await db
    .from("notifikasi")
    .update({ is_read: parsed.data.isRead })
    .eq("id", parsed.data.notifId);

  if (error) return { error: `Gagal memperbarui: ${error.message}` };

  revalidatePath("/admin/perhatian");
  return { error: null };
}