import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/database.types";

export type Shift = Tables<"shifts">;

/**
 * Tanggal operasional sebuah kedai, dalam zona waktunya sendiri.
 *
 * Tidak boleh memakai tanggal server. Server berjalan di UTC; kalau kasir di
 * Jakarta bertransaksi jam 00:30, tanggal UTC-nya masih hari kemarin dan
 * penjualan itu akan masuk laporan hari yang salah.
 *
 * Locale `en-CA` dipakai karena formatnya persis YYYY-MM-DD -- sama dengan
 * yang diharapkan kolom `date` di Postgres.
 */
export function businessDate(timezone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(at);
}

/** Shift yang sedang terbuka di sebuah kedai, atau null kalau toko tutup. */
export async function getOpenShift(kedaiId: string): Promise<Shift | null> {
  const db = createAdminClient();

  const { data } = await db
    .from("shifts")
    .select("*")
    .eq("kedai_id", kedaiId)
    .eq("status", "open")
    .maybeSingle();

  return data ?? null;
}

/**
 * Shift TERAKHIR sebuah kedai (terbuka atau tertutup).
 *
 * Dipakai halaman shift POS: kalau tertutup, kasir masih harus mengisi
 * hitungan fisik (sisa fisik) -- dan itu melekat pada shift yang tadi.
 */
export async function getLastShift(kedaiId: string): Promise<Shift | null> {
  const db = createAdminClient();

  const { data } = await db
    .from("shifts")
    .select("*")
    .eq("kedai_id", kedaiId)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

/**
 * Total transaksi tunai yang SUDAH sampai server untuk sebuah shift.
 *
 * Dipakai menghitung `expected_cash`. Transaksi yang masih di antrian
 * offline belum terhitung di sini -- itulah kenapa penutupan shift bisa
 * berstatus `pending_sync` (lihat docs/Database.md §4).
 */
export async function totalTunaiShift(shiftId: string): Promise<number> {
  const db = createAdminClient();

  const { data } = await db
    .from("transactions")
    .select("total")
    .eq("shift_id", shiftId)
    .eq("payment_method", "tunai")
    .eq("status", "completed");

  return (data ?? []).reduce((n, t) => n + Number(t.total), 0);
}
