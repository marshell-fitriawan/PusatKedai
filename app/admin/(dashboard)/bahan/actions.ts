"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type FormState = {
  error: string | null;
  ok?: boolean;
  fieldErrors?: Record<string, string>;
};

/**
 * Bahan mentah: katalog + stok. Semua operasi di sini kerja pemilik (admin).
 * Produksi dan penambahan stok memakai fungsi DB (record_bahan_movement)
 * lewat admin client -- fungsi dicabut dari anon/authenticated, hanya
 * service_role yang boleh memanggil (docs/Database.md §10-11).
 */

const bahanSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama bahan wajib diisi")
    .max(100, "Nama terlalu panjang (maksimal 100 karakter)"),
  satuan: z
    .string()
    .trim()
    .min(1, "Satuan wajib diisi (mis. gram, kg, bungkus)")
    .max(30, "Satuan terlalu panjang"),
  harga_beli: z.coerce
    .number({ message: "Harga beli harus berupa angka" })
    .min(0, "Harga beli tidak boleh negatif")
    .max(99_999_999, "Harga beli terlalu besar")
    .optional(),
});

function parse(isoFormData: FormData) {
  const harga = isoFormData.get("harga_beli");
  return bahanSchema.safeParse({
    name: isoFormData.get("name"),
    satuan: isoFormData.get("satuan"),
    harga_beli:
      typeof harga === "string" && harga.trim() !== "" ? Number(harga) : undefined,
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

export async function createBahan(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: "Periksa kembali isian.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("bahan_mentah").insert({
    name: parsed.data.name,
    satuan: parsed.data.satuan,
    harga_beli: parsed.data.harga_beli ?? null,
  });

  if (error) {
    return { error: `Gagal menyimpan bahan: ${error.message}` };
  }

  revalidatePath("/admin/bahan");
  return { error: null, ok: true };
}

export async function updateBahan(
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
  const { error } = await supabase
    .from("bahan_mentah")
    .update({
      name: parsed.data.name,
      satuan: parsed.data.satuan,
      harga_beli: parsed.data.harga_beli ?? null,
    })
    .eq("id", id);

  if (error) {
    return { error: `Gagal memperbarui bahan: ${error.message}` };
  }

  revalidatePath("/admin/bahan");
  return { error: null, ok: true };
}

export async function setBahanActive(id: string, isActive: boolean) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase
    .from("bahan_mentah")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) throw new Error(`Gagal mengubah status bahan: ${error.message}`);
  revalidatePath("/admin/bahan");
}

export type HasilStok = {
  error: string | null;
  quantity?: number;
};

const schemaTambah = z.object({
  bahanId: z.string().uuid(),
  qty: z.coerce
    .number({ message: "Jumlah harus berupa angka" })
    .int("Jumlah harus bilangan bulat")
    .min(1, "Jumlah penambahan harus lebih dari nol")
    .max(999_999, "Jumlah terlalu besar"),
  note: z
    .string()
    .trim()
    .max(255, "Catatan terlalu panjang")
    .optional(),
});

/** Tambah stok bahan secara manual (bahan_movement reason 'masuk'). */
export async function tambahStokBahan(
  bahanId: string,
  qty: number,
  note: string,
): Promise<HasilStok> {
  const admin = await requireAdmin();

  const parsed = schemaTambah.safeParse({ bahanId, qty, note });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const db = createAdminClient();
  const { data, error } = await db.rpc("record_bahan_movement", {
    p_id: randomUUID(),
    p_bahan_id: parsed.data.bahanId,
    p_delta: parsed.data.qty,
    p_reason: "masuk",
    p_note: parsed.data.note || "",
    p_admin_id: admin.id,
  });

  if (error) return { error: `Gagal menambah stok: ${error.message}` };

  revalidatePath("/admin/bahan");
  revalidatePath("/admin/stok");
  return { error: null, quantity: (Array.isArray(data) ? data[0] : data)?.quantity };
}

const schemaKoreksi = z.object({
  bahanId: z.string().uuid(),
  // Target KUANTITAS (bukan delta), konsisten dengan adjust_stok produk.
  target: z.coerce
    .number({ message: "Jumlah harus berupa angka" })
    .int("Jumlah harus bilangan bulat")
    .min(-999_999)
    .max(999_999),
  note: z
    .string()
    .trim()
    .min(3, "Alasan koreksi minimal 3 karakter")
    .max(255, "Alasan terlalu panjang"),
});

/** Koreksi stok bahan ke angka tertentu (bahan_movement reason 'koreksi'). */
export async function koreksiStokBahan(
  bahanId: string,
  target: number,
  note: string,
): Promise<HasilStok> {
  const admin = await requireAdmin();

  const parsed = schemaKoreksi.safeParse({ bahanId, target, note });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const db = createAdminClient();

  const { data: saldo } = await db
    .from("bahan_stock")
    .select("quantity")
    .eq("bahan_id", parsed.data.bahanId)
    .maybeSingle();

  const delta = parsed.data.target - (saldo?.quantity ?? 0);
  if (delta === 0) return { error: "Angka ini sudah sesuai stok saat ini." };

  const { error } = await db.rpc("record_bahan_movement", {
    p_id: randomUUID(),
    p_bahan_id: parsed.data.bahanId,
    p_delta: delta,
    p_reason: "koreksi",
    p_note: parsed.data.note,
    p_admin_id: admin.id,
  });

  if (error) return { error: `Gagal mengoreksi stok: ${error.message}` };

  revalidatePath("/admin/bahan");
  return { error: null };
}

export type BarisRiwayat = {
  created_at: string;
  delta: number;
  balance_after: number;
  reason: string;
  note: string | null;
};

const labelAlasan: Record<string, string> = {
  masuk: "Tambah manual",
  produksi: "Dipakai produksi",
  koreksi: "Koreksi",
};

/** Riwayat pergerakan stok satu bahan (M6-3). */
export async function riwayatBahan(
  bahanId: string,
): Promise<{ error: string | null; data?: BarisRiwayat[] }> {
  await requireAdmin();

  const db = createAdminClient();

  const { data, error } = await db
    .from("bahan_movement")
    .select("created_at, delta, balance_after, reason, note")
    .eq("bahan_id", bahanId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return { error: error.message };
  return {
    error: null,
    data: (data ?? []).map((r) => ({
      ...r,
      reason: labelAlasan[r.reason] ?? r.reason,
    })),
  };
}