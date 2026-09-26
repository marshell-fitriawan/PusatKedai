"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type FormState = {
  error: string | null;
  /** true kalau simpan berhasil -- dipakai UI untuk menutup modal. */
  ok?: boolean;
  /** Pesan error per kolom, dipakai untuk menandai input yang salah. */
  fieldErrors?: Record<string, string>;
};

const karyawanSchema = z.object({
  kedai_id: z.string().uuid({ message: "Pilih kedai yang benar" }),
  name: z
    .string()
    .trim()
    .min(1, "Nama karyawan wajib diisi")
    .max(100, "Nama terlalu panjang (maksimal 100 karakter)"),
  role: z.enum(["kasir", "admin_kedai"], { message: "Peran tidak dikenal" }),
});

function parse(formData: FormData) {
  return karyawanSchema.safeParse({
    kedai_id: formData.get("kedai_id"),
    name: formData.get("name"),
    role: formData.get("role"),
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

/**
 * Token QR karyawan.
 *
 * Dipakai untuk login di /pos/masuk. Kriptografis-acak: menebaknya tidak
 * lebih mudah daripada menebak password, dan unik karena constraint UNIQUE
 * (collision dipastikan secara statistik mustahil dengan 18 byte acak).
 */
function generateQrToken(): string {
  return randomBytes(18).toString("base64url");
}

export async function createKaryawan(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: "Periksa kembali isian.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("employees").insert({
    ...parsed.data,
    qr_token: generateQrToken(),
  });

  if (error) {
    return { error: `Gagal menyimpan karyawan: ${error.message}` };
  }

  revalidatePath("/admin/karyawan");
  return { error: null, ok: true };
}

export async function updateKaryawan(
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
  // qr_token sengaja tidak bisa diubah lewat form -- tujuannya regenerasi
  // eksplisit lewat resetQrToken, supaya kartu lama yang tersebar tahu
  // alasannya di-revoke dan dicetak ulang.
  const { error } = await supabase
    .from("employees")
    .update(parsed.data)
    .eq("id", id);

  if (error) {
    return { error: `Gagal memperbarui karyawan: ${error.message}` };
  }

  revalidatePath("/admin/karyawan");
  return { error: null, ok: true };
}

/**
 * Menonaktifkan karyawan, bukan menghapusnya.
 *
 * Alasan sama dengan kedai: transaksi, shift, dan absensi yang sudah terjadi
 * tetap merujuk karyawan ini, dan riwayat itu wajib utuh. Karyawan nonaktif
 * ditolak saat pindai QR (cek is_active di mulaiSesi).
 */
export async function setKaryawanActive(id: string, isActive: boolean) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) throw new Error(`Gagal mengubah status karyawan: ${error.message}`);

  revalidatePath("/admin/karyawan");
}

/**
 * Menerbitkan token QR baru. Mematikan kartu lama: scanning kartu lama
 * tidak akan membuka sesi lagi, jadi kartu yang hilang tidak jadi pintu
 * masuk selamanya.
 */
export async function resetQrToken(id: string) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({ qr_token: generateQrToken() })
    .eq("id", id);

  if (error) throw new Error(`Gagal menerbitkan token baru: ${error.message}`);

  revalidatePath("/admin/karyawan");
}