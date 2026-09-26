import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabaseServiceRoleKey, supabaseUrl } from "./env";

/**
 * Client dengan service role key -- MELEWATI SELURUH RLS.
 *
 * Hanya untuk operasi yang memang harus lintas kedai atau tanpa identitas
 * user, dan semuanya server-side:
 *   - endpoint sync transaksi offline (M2-4)
 *   - eksekusi perpindahan stok setelah approval (M4-5)
 *   - rekonsiliasi shift yang tertunda (M3-9)
 *   - sesi karyawan lewat QR, karena bukan user Supabase Auth (M3-4)
 *
 * Import "server-only" di atas membuat build GAGAL kalau file ini pernah
 * ikut terbawa ke bundle client -- lebih baik ketahuan saat build daripada
 * service role key bocor ke browser.
 *
 * Aturan pakai: setiap pemanggilan wajib memfilter kedai_id secara eksplisit.
 * RLS tidak akan menolong di sini.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: {
      // Tidak ada sesi user untuk disimpan atau disegarkan.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
