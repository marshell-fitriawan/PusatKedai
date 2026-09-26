import { NextResponse } from "next/server";
import { z } from "zod";
import { getPosSession } from "@/lib/pos/session";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Endpoint sinkronisasi antrian transaksi offline (M2-4, M3-7).
 *
 * KENAPA ROUTE HANDLER, BUKAN SERVER ACTION
 * Antrian dikirim dari kode latar yang tidak selalu punya konteks React.
 * Route handler adalah HTTP biasa: bisa dipanggil dari mana saja, dan
 * responsnya bisa diperiksa per item.
 *
 * SHIFT DIAMBIL DARI TIAP TRANSAKSI, BUKAN DARI SHIFT YANG SEDANG TERBUKA.
 * Transaksi yang dibuat sebelum toko tutup harus tetap masuk ke shift
 * lamanya. Kalau dipaksa ke shift yang sedang terbuka, rekonsiliasi kas DUA
 * shift sekaligus jadi salah: yang lama kekurangan, yang baru kelebihan --
 * dan keduanya terlihat seperti kasir menghilangkan atau menambah uang.
 *
 * IDEMPOTEN DI TIGA LAPIS:
 *   1. `create_transaction` mengembalikan nomor yang sudah ada kalau id-nya
 *      pernah tersimpan
 *   2. unique index ledger menolak pengurangan stok kedua
 *   3. klien menghapus item dari antrian hanya setelah server mengonfirmasi
 *
 * Satu item gagal TIDAK membatalkan yang lain. Memaksa seluruh batch gagal
 * karena satu item rusak berarti penjualan yang sah ikut tertahan.
 */

const itemSchema = z.object({
  product_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  price: z.number().int().min(0).max(99_999_999),
  qty: z.number().int().min(1).max(9999),
});

const trxSchema = z.object({
  id: z.string().uuid(),
  shiftId: z.string().uuid(),
  localNumber: z.string().min(1).max(50),
  deviceId: z.string().min(1).max(100),
  createdAt: z.string().datetime(),
  items: z.array(itemSchema).min(1),
});

const bodySchema = z.object({
  // Dibatasi supaya satu permintaan tidak pernah berjalan terlalu lama.
  // Antrian yang lebih panjang dikirim dalam beberapa gelombang.
  transactions: z.array(trxSchema).min(1).max(50),
});

export type HasilSyncItem = {
  id: string;
  ok: boolean;
  transactionNumber?: string;
  error?: string;
  /** true = jangan dicoba lagi, datanya memang tidak bisa diterima. */
  permanen?: boolean;
};

export async function POST(request: Request) {
  const session = await getPosSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sesi kasir tidak ditemukan" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Format antrian tidak valid" },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  // Shift yang disebut perangkat harus benar-benar milik kedai pada sesi ini.
  // Tanpa pemeriksaan ini, perangkat bisa menitipkan transaksi ke shift kedai
  // lain hanya dengan menebak id-nya.
  const shiftIds = [...new Set(parsed.data.transactions.map((t) => t.shiftId))];

  const { data: shiftSah } = await db
    .from("shifts")
    .select("id")
    .eq("kedai_id", session.kedaiId)
    .in("id", shiftIds);

  const sah = new Set((shiftSah ?? []).map((s) => s.id));

  const hasil: HasilSyncItem[] = [];
  /** Berapa transaksi berhasil masuk per shift, untuk rekonsiliasi. */
  const masukPerShift = new Map<string, number>();

  for (const trx of parsed.data.transactions) {
    if (!sah.has(trx.shiftId)) {
      hasil.push({
        id: trx.id,
        ok: false,
        error: "Shift tidak dikenali di kedai ini",
        permanen: true,
      });
      continue;
    }

    const { data, error } = await db.rpc("create_transaction", {
      p_id: trx.id,
      // Dari SESI, bukan dari payload. Perangkat tidak boleh menentukan
      // kedai atau karyawan mana yang dicatat.
      p_kedai_id: session.kedaiId,
      p_employee_id: session.employeeId,
      p_shift_id: trx.shiftId,
      p_local_number: trx.localNumber,
      p_device_id: trx.deviceId,
      p_payment_method: "tunai",
      p_created_at: trx.createdAt,
      p_items: trx.items,
    });

    if (error) {
      // 23xxx = pelanggaran constraint: datanya memang tidak bisa diterima,
      // mencoba lagi tidak akan mengubah apa pun. Error lain (jaringan,
      // timeout) layak diulang.
      const permanen = /^23/.test(error.code ?? "");
      hasil.push({ id: trx.id, ok: false, error: error.message, permanen });
      continue;
    }

    const baris = Array.isArray(data) ? data[0] : data;
    hasil.push({
      id: trx.id,
      ok: true,
      transactionNumber: baris?.transaction_number ?? undefined,
    });

    masukPerShift.set(trx.shiftId, (masukPerShift.get(trx.shiftId) ?? 0) + 1);
  }

  // Hitung ulang kas tiap shift yang menerima transaksi. Untuk shift yang
  // sudah ditutup, ini yang perlahan menurunkan `pending_sync_count` sampai
  // nol -- dan baru saat itu selisih kasnya boleh dianggap sah.
  for (const [shiftId, jumlah] of masukPerShift) {
    await db.rpc("reconcile_shift", { p_shift_id: shiftId, p_applied: jumlah });
  }

  return NextResponse.json({ hasil });
}
