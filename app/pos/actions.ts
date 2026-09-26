"use server";

import { redirect } from "next/navigation";
import { clearPosSession, setPosSession } from "@/lib/pos/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type SesiState = { error: string | null };

/**
 * Memulai sesi kasir dari token QR karyawan.
 *
 * Karyawan bukan user Supabase Auth, jadi inilah satu-satunya tempat
 * identitas mereka diverifikasi. Semua halaman POS mempercayai cookie yang
 * dihasilkan di sini.
 *
 * Memakai admin client karena RLS akan menolak pemanggil tanpa sesi Auth.
 * Seperti aturan di lib/supabase/admin.ts, query di bawah memfilter
 * eksplisit -- dan yang paling penting: `kedai_id` diambil dari DATA
 * KARYAWAN, tidak pernah dari input. Kalau kedai ikut dikirim dari
 * perangkat, satu kasir bisa mengaku bertugas di cabang lain dan
 * transaksinya tercatat di kedai yang salah.
 */
export async function mulaiSesi(
  _prev: SesiState,
  formData: FormData,
): Promise<SesiState> {
  const token = String(formData.get("qr_token") ?? "").trim();

  if (!token) {
    return { error: "Token QR kosong. Pindai kartu atau masukkan kodenya." };
  }

  const db = createAdminClient();

  const { data: employee, error } = await db
    .from("employees")
    .select("id, name, is_active, kedai:kedai_id (id, name, is_active)")
    .eq("qr_token", token)
    .maybeSingle();

  if (error) {
    return { error: `Gagal memeriksa kartu: ${error.message}` };
  }

  // Pesan sengaja tidak membedakan "token tidak ada" dan "karyawan nonaktif".
  // Membedakannya memberi tahu penebak bahwa sebuah token itu valid.
  if (!employee || !employee.is_active) {
    return { error: "Kartu tidak dikenali atau sudah tidak berlaku." };
  }

  const kedai = employee.kedai as unknown as {
    id: string;
    name: string;
    is_active: boolean;
  } | null;

  if (!kedai || !kedai.is_active) {
    return { error: "Kedai karyawan ini sedang nonaktif." };
  }

  await setPosSession({
    kedaiId: kedai.id,
    kedaiName: kedai.name,
    employeeId: employee.id,
    employeeName: employee.name,
  });

  redirect("/pos/kasir");
}

export async function keluarPos() {
  await clearPosSession();
  redirect("/pos/masuk");
}
