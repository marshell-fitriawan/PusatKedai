import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

const COOKIE = "pos_session";

/**
 * Sesi perangkat kasir.
 *
 * Karyawan BUKAN user Supabase Auth (mereka login lewat QR), jadi sesinya
 * tidak bisa memakai mekanisme Auth. Cookie ini adalah penggantinya.
 *
 * Diisi HANYA oleh `mulaiSesi()` di app/pos/actions.ts, setelah token QR
 * dicocokkan ke `employees.qr_token`. Tidak ada jalur lain yang menulisnya.
 *
 * `kedaiId` di sini berasal dari data karyawan, bukan dari input perangkat.
 * Itu yang mencegah satu kasir mengaku bertugas di cabang lain.
 *
 * Cookie-nya httpOnly, jadi tidak bisa dibaca atau diubah JavaScript di
 * browser. Isinya tetap divalidasi ulang dengan Zod saat dibaca -- cookie
 * bisa saja tertinggal dari versi lama dengan bentuk berbeda.
 */
const sessionSchema = z.object({
  kedaiId: z.string().uuid(),
  employeeId: z.string().uuid(),
  employeeName: z.string(),
  kedaiName: z.string(),
});

export type PosSession = z.infer<typeof sessionSchema>;

export async function getPosSession(): Promise<PosSession | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = sessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    // Cookie rusak atau dari versi lama -- perlakukan seperti belum ada sesi.
    return null;
  }
}

export async function setPosSession(session: PosSession): Promise<void> {
  (await cookies()).set(COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Satu minggu: kasir tidak perlu memilih ulang tiap hari, tapi perangkat
    // yang hilang tidak jadi pintu masuk selamanya.
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearPosSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
