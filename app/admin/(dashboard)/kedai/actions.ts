"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TIMEZONE_VALUES } from "@/lib/timezones";

export type FormState = {
  error: string | null;
  /** true kalau simpan berhasil -- dipakai UI untuk menutup modal. */
  ok?: boolean;
  /** Pesan error per kolom, dipakai untuk menandai input yang salah. */
  fieldErrors?: Record<string, string>;
};

/**
 * Validasi dijalankan di SERVER, bukan hanya di form.
 *
 * Atribut `required` di HTML cuma membantu user; server action bisa dipanggil
 * langsung tanpa lewat form sama sekali, jadi input tetap harus diperiksa
 * ulang di sini.
 */
const kedaiSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama kedai wajib diisi")
    .max(100, "Nama terlalu panjang (maksimal 100 karakter)"),
  address: z.string().trim().max(255, "Alamat terlalu panjang").optional(),
  phone: z.string().trim().max(30, "Nomor telepon terlalu panjang").optional(),
  timezone: z.enum(TIMEZONE_VALUES as [string, ...string[]], {
    message: "Zona waktu tidak dikenal",
  }),
  low_stock_threshold: z.coerce
    .number({ message: "Ambang stok harus berupa angka" })
    .int("Ambang stok harus bilangan bulat")
    .min(0, "Ambang stok tidak boleh negatif")
    .max(9999, "Ambang stok terlalu besar"),
  is_warehouse: z.boolean(),
});

function parse(formData: FormData) {
  return kedaiSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") || undefined,
    phone: formData.get("phone") || undefined,
    timezone: formData.get("timezone"),
    low_stock_threshold: formData.get("low_stock_threshold"),
    // Checkbox: hadir = "on", tidak = null. Convert di sini supaya schema
    // tetap menerima boolean, bukan string.
    is_warehouse: formData.get("is_warehouse") === "on",
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

export async function createKedai(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: "Periksa kembali isian.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("kedai").insert(parsed.data);

  if (error) {
    return { error: `Gagal menyimpan kedai: ${error.message}` };
  }

  revalidatePath("/admin/kedai");
  return { error: null, ok: true };
}

export async function updateKedai(
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
  const { error } = await supabase.from("kedai").update(parsed.data).eq("id", id);

  if (error) {
    return { error: `Gagal memperbarui kedai: ${error.message}` };
  }

  revalidatePath("/admin/kedai");
  return { error: null, ok: true };
}

/**
 * Menonaktifkan kedai, bukan menghapusnya.
 *
 * Kedai tetap direferensikan transaksi, shift, stok, dan pengeluaran yang
 * sudah terjadi. Menghapusnya akan memutus riwayat -- dan foreign key-nya
 * memang memakai `on delete restrict`, jadi database pun menolak.
 */
export async function setKedaiActive(id: string, isActive: boolean) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase
    .from("kedai")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) throw new Error(`Gagal mengubah status kedai: ${error.message}`);

  revalidatePath("/admin/kedai");
}
