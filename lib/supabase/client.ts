import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Client Supabase untuk komponen browser.
 *
 * Memakai anon key, jadi seluruh aksesnya tunduk pada RLS. Untuk operasi
 * yang harus melewati RLS (sync transaksi, eksekusi mutasi stok, rekonsiliasi
 * shift) pakai createAdminClient di ./admin -- dan itu hanya boleh dipanggil
 * dari server.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}
