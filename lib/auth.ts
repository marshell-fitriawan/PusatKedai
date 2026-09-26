import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

export type AdminUser = Tables<"admin_users">;

/**
 * Baris admin_users milik pemanggil, atau null.
 *
 * Punya sesi Supabase Auth saja TIDAK cukup. Pendaftaran user bisa terbuka,
 * jadi identitas yang sah belum tentu berhak -- yang menentukan adalah
 * keberadaannya di admin_users dengan is_active true.
 *
 * Query ini memakai sesi user sendiri (bukan service role), jadi ikut lewat
 * RLS. Untuk non-admin hasilnya nol baris, konsisten dengan policy.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient();

  // getUser() memvalidasi token ke server Supabase. Jangan pakai getSession()
  // untuk keputusan otorisasi -- isinya cookie yang bisa dipalsukan.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("admin_users")
    .select("*")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  return data ?? null;
}

/**
 * Sama dengan getAdminUser, tapi mengalihkan ke login kalau tidak berhak.
 * Dipakai di layout /admin/(dashboard) sebagai gerbang terakhir.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login?error=forbidden");
  return admin;
}
