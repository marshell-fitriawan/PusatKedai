"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };

/**
 * Login admin.
 *
 * Dua lapis pemeriksaan yang sengaja dipisah:
 *   1. Kredensial benar (Supabase Auth)
 *   2. User terdaftar di admin_users dan aktif
 *
 * Kalau lapis 2 gagal, sesinya langsung dicabut. Tanpa itu, user yang sah
 * tapi tidak berhak akan "berhasil login" lalu melihat dashboard kosong --
 * membingungkan, dan menyembunyikan fakta bahwa ia memang tidak berhak.
 */
export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) {
    return { error: "Email dan password wajib diisi." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    // Pesan sengaja tidak membedakan "email tidak terdaftar" dan "password
    // salah" -- membedakannya membocorkan email mana yang punya akun.
    return { error: "Email atau password salah." };
  }

  const { data: admin } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", data.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!admin) {
    await supabase.auth.signOut();
    return { error: "Akun ini tidak punya akses admin." };
  }

  // Hanya menerima path internal. Tanpa pemeriksaan ini, ?next=//situs-lain
  // menjadikan halaman login alat open redirect.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/admin/dashboard";

  redirect(target);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
