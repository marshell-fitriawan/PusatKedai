"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPosSession } from "@/lib/pos/session";
import { businessDate, getOpenShift } from "@/lib/pos/shift";
import { createAdminClient } from "@/lib/supabase/admin";

export type ShiftState = { error: string | null; ok?: boolean };

export type HasilTutup = {
  error: string | null;
  /** Blind closing (keputusan 10): expected_cash/selisih TIDAK dikirim ke
   *  perangkat karyawan. Hanya status rekonsiliasi + jumlah antrian. */
  status?: "pending_sync" | "final";
  tertunda?: number;
};

const bukaSchema = z.object({
  opening_cash: z.coerce
    .number({ message: "Kas awal harus berupa angka" })
    .int("Kas awal harus bilangan bulat")
    .min(0, "Kas awal tidak boleh negatif")
    .max(999_999_999, "Kas awal terlalu besar"),
});

/**
 * Membuka toko: mencatat kas awal dan memulai shift.
 *
 * `kedai_id` dan `opened_by` diambil dari sesi, TIDAK dari form. Perangkat
 * hanya boleh menentukan jumlah uangnya, bukan atas nama siapa dan di kedai
 * mana shift itu dibuka.
 */
export async function bukaToko(
  _prev: ShiftState,
  formData: FormData,
): Promise<ShiftState> {
  const session = await getPosSession();
  if (!session) return { error: "Sesi kasir berakhir. Pindai kartu lagi." };

  const parsed = bukaSchema.safeParse({
    opening_cash: formData.get("opening_cash"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Kas awal tidak valid." };
  }

  const db = createAdminClient();

  const { data: kedai } = await db
    .from("kedai")
    .select("timezone")
    .eq("id", session.kedaiId)
    .maybeSingle();

  const { error } = await db.from("shifts").insert({
    kedai_id: session.kedaiId,
    business_date: businessDate(kedai?.timezone ?? "Asia/Kuala_Lumpur"),
    opened_by: session.employeeId,
    opening_cash: parsed.data.opening_cash,
  });

  if (error) {
    // 23505 = pelanggaran unique. Di sini artinya partial unique index
    // `shifts_one_open_per_kedai` menolak shift kedua -- dan itu memang
    // perilaku yang diinginkan, bukan kegagalan sistem.
    if (error.code === "23505") {
      return {
        error:
          "Kedai ini sudah punya shift yang terbuka. Muat ulang halaman untuk melihatnya.",
      };
    }
    return { error: `Gagal membuka toko: ${error.message}` };
  }

  revalidatePath("/pos/shift");
  revalidatePath("/pos/kasir");
  return { error: null, ok: true };
}

const tutupSchema = z.object({
  closingCash: z.coerce
    .number({ message: "Kas akhir harus berupa angka" })
    .int("Kas akhir harus bilangan bulat")
    .min(0, "Kas akhir tidak boleh negatif")
    .max(999_999_999, "Kas akhir terlalu besar"),
  /** Jumlah transaksi yang masih di antrian perangkat. */
  pendingCount: z.coerce.number().int().min(0).max(10_000),
});

/**
 * Menutup toko.
 *
 * `pendingCount` dilaporkan PERANGKAT, karena hanya perangkat yang tahu isi
 * antrian offline-nya sendiri. Server memakainya untuk menandai apakah
 * selisih kas sudah boleh dianggap sah.
 *
 * Kasir TIDAK diminta menunggu antrian kosong. Internet mati total adalah
 * kejadian nyata, dan toko tetap harus bisa tutup.
 */
export async function tutupToko(
  closingCash: number,
  pendingCount: number,
): Promise<HasilTutup> {
  const session = await getPosSession();
  if (!session) return { error: "Sesi kasir berakhir. Pindai kartu lagi." };

  const parsed = tutupSchema.safeParse({ closingCash, pendingCount });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const shift = await getOpenShift(session.kedaiId);
  if (!shift) return { error: "Tidak ada shift yang sedang terbuka." };

  const db = createAdminClient();

  const { data, error } = await db.rpc("close_shift", {
    p_shift_id: shift.id,
    p_kedai_id: session.kedaiId,
    p_employee_id: session.employeeId,
    p_closing_cash: parsed.data.closingCash,
    p_pending_count: parsed.data.pendingCount,
  });

  if (error) return { error: `Gagal menutup toko: ${error.message}` };

  const hasil = Array.isArray(data) ? data[0] : data;

  // Beri tahu pemilik: ada shift yang menunggu diperiksa di Collect (M7-6).
  const kedai = await db.from("kedai").select("name").eq("id", session.kedaiId).maybeSingle();
  const notifikasi: {
    kedai_id: string;
    shift_id: string;
    type: "shift_selesai" | "selisih" | "device_stale";
    title: string;
    message: string;
  }[] = [
    {
      kedai_id: session.kedaiId,
      shift_id: shift.id,
      type: "shift_selesai",
      title: `Toko ditutup — ${kedai.data?.name ?? "kedai"}`,
      message: `Shift ${shift.business_date} menunggu pemeriksaan di halaman Collect.`,
    },
  ];

  // Perangkat menutup toko saat MASIH ada antrian offline: kas belum final
  // dan bakal berubah saat antrian itu masuk belakangan (M8-4). Tandai ke
  // pemilik supaya angka yang belum tentu tidak dianggap pasti.
  if (hasil && Number(hasil.pending_sync_count ?? 0) > 0) {
    notifikasi.push({
      kedai_id: session.kedaiId,
      shift_id: shift.id,
      type: "device_stale",
      title: `Perangkat belum sinkron — ${kedai.data?.name ?? "kedai"}`,
      message: `Penutupan ${shift.business_date} selesai dengan ${hasil.pending_sync_count} transaksi masih di perangkat belum terkirim. Hitungan kas belum pasti sampai semuanya masuk.`,
    });
  }

  // Selisih hanya sah kalau sudah final (semua antrian masuk). Kalau masih
  // pending, nilainya akan dihitung ulang server -- tunda peringatannya.
  if (
    hasil &&
    hasil.reconciliation_status === "final" &&
    hasil.cash_difference !== null &&
    hasil.cash_difference !== undefined &&
    Number(hasil.cash_difference) !== 0
  ) {
    notifikasi.push({
      kedai_id: session.kedaiId,
      shift_id: shift.id,
      type: "selisih",
      title: `Selisih kas — ${kedai.data?.name ?? "kedai"}`,
      message: `Penutupan ${shift.business_date} punya selisih yang perlu diselesaikan di Collect.`,
    });
  }

  await db.from("notifikasi").insert(notifikasi);

  revalidatePath("/pos/shift");
  revalidatePath("/pos/kasir");

  // Blind closing: angka selisih dihitung & disimpan server, tapi TIDAK
  // dikembalikan -- karyawan tidak boleh menyesuaikan kas biar "pas".
  return {
    error: null,
    status: hasil?.reconciliation_status as "pending_sync" | "final",
    tertunda: hasil?.pending_sync_count ?? 0,
  };
}

const sisaFisikSchema = z.object({
  shiftId: z.string().uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce
          .number({ message: "Sisa fisik harus berupa angka" })
          .int("Sisa fisik harus bilangan bulat")
          .min(0, "Sisa fisik tidak boleh negatif")
          .max(999_999, "Sisa fisik terlalu besar"),
      }),
    )
    .max(200)
    .default([]),
});

export type HasilSisaFisik = { error: string | null };

/**
 * Menyimpan hitungan fisik (`sisa_fisik`) saat tutup (M7-2).
 *
 * Hanya shift yang sudah `closed` di KEDAI ini yang boleh diisi. Satu baris
 * per (shift, produk) -- kasir mengisi angka terkini; selisih dengan ledger
 * dihitung pemilik di halaman Collect (keputusan 10 & 11).
 */
export async function simpanSisaFisik(
  shiftId: string,
  items: { productId: string; quantity: number }[],
): Promise<HasilSisaFisik> {
  const session = await getPosSession();
  if (!session) return { error: "Sesi kasir berakhir. Pindai kartu lagi." };

  const parsed = sisaFisikSchema.safeParse({ shiftId, items });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const db = createAdminClient();

  // Hanya shift kedai ini & yang tertutup.
  const { data: shift } = await db
    .from("shifts")
    .select("kedai_id, status")
    .eq("id", parsed.data.shiftId)
    .maybeSingle();
  if (!shift || shift.kedai_id !== session.kedaiId) {
    return { error: "Shift tidak ditemukan di kedai ini." };
  }
  if (shift.status !== "closed") {
    return { error: "Hitungan fisik hanya bisa disimpan setelah toko tutup." };
  }

  if (parsed.data.items.length === 0) return { error: null };

  const { error } = await db
    .from("sisa_fisik")
    .upsert(
      parsed.data.items.map((i) => ({
        shift_id: shiftId,
        product_id: i.productId,
        quantity: i.quantity,
      })),
      { onConflict: "shift_id,product_id" },
    );

  if (error) return { error: `Gagal menyimpan sisa fisik: ${error.message}` };

  revalidatePath("/pos/shift");
  return { error: null };
}

const wasteSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce
    .number({ message: "Jumlah waste harus berupa angka" })
    .int("Jumlah waste harus bilangan bulat")
    .min(1, "Jumlah waste harus lebih dari nol")
    .max(999_999, "Jumlah waste terlalu besar"),
  alasan: z
    .string()
    .trim()
    .min(3, "Alasan wajib diisi (minimal 3 karakter)")
    .max(255, "Alasan terlalu panjang"),
});

export type HasilWaste = { error: string | null; quantity?: number };

/**
 * Mencatat stok hilang sah (M7-3): `record_waste` memotong stok + menulis
 * ledger reason `waste` dalam satu transaction. Alasan wajib; stok tidak
 * cukup -> ditolak. Idempoten per p_id (retry tidak menggandakan potongan).
 */
export async function catatWaste(
  productId: string,
  quantity: number,
  alasan: string,
): Promise<HasilWaste> {
  const session = await getPosSession();
  if (!session) return { error: "Sesi kasir berakhir. Pindai kartu lagi." };

  const parsed = wasteSchema.safeParse({ productId, quantity, alasan });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  // Waste dicatat saat shift sedang berjalan; lekatkan ke shift aktif supaya
  // pemilik bisa menelusuri stok per sesi.
  const shift = await getOpenShift(session.kedaiId);
  if (!shift) return { error: "Tidak ada shift yang sedang terbuka." };

  const db = createAdminClient();
  const { data, error } = await db.rpc("record_waste", {
    p_id: randomUUID(),
    p_kedai_id: session.kedaiId,
    p_shift_id: shift.id,
    p_product_id: parsed.data.productId,
    p_quantity: parsed.data.quantity,
    p_alasan: parsed.data.alasan,
    p_employee_id: session.employeeId,
  });

  if (error) return { error: `Gagal mencatat waste: ${error.message}` };

  const hasil = Array.isArray(data) ? data[0] : data;

  revalidatePath("/pos/shift");
  return { error: null, quantity: Number(hasil?.quantity ?? 0) };
}
