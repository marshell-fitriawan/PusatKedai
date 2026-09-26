/**
 * Zona waktu yang didukung untuk kedai.
 *
 * DILETAKKAN DI SINI, BUKAN DI FILE SERVER ACTION.
 *
 * File ber-`"use server"` hanya boleh mengekspor fungsi async. Kalau konstanta
 * seperti ini ikut diekspor dari sana, Next mengubahnya jadi referensi server
 * action -- dan komponen client yang mengimpornya akan menerima sesuatu yang
 * bukan array. Gejalanya di produksi: `TypeError: n is not iterable`, tanpa
 * petunjuk apa pun ke penyebabnya.
 *
 * Build dan typecheck TIDAK menangkap kesalahan ini. Hanya menjalankan
 * halamannya yang menangkap.
 */
export const TIMEZONES = [
  { value: "Asia/Kuala_Lumpur", label: "Malaysia — Asia/Kuala_Lumpur" },
  { value: "Asia/Singapore", label: "Asia/Singapore" },
  { value: "Asia/Jakarta", label: "WIB — Asia/Jakarta" },
  { value: "Asia/Makassar", label: "WITA — Asia/Makassar" },
  { value: "Asia/Jayapura", label: "WIT — Asia/Jayapura" },
] as const;

export const TIMEZONE_VALUES = TIMEZONES.map((t) => t.value);
