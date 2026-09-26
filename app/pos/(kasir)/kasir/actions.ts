"use server";

import { z } from "zod";
import { getPosSession } from "@/lib/pos/session";
import { getOpenShift } from "@/lib/pos/shift";
import { createAdminClient } from "@/lib/supabase/admin";
import { QRIS_EXPIRY_MENIT, chargeQris } from "@/lib/payment/midtrans";

export type HasilMulaiQris =
  | {
      error: null;
      id: string;
      orderId: string;
      qrContent: string;
      qrImageUrl: string | null;
      expiresAt: string;
      total: number;
    }
  | { error: string };

const itemQrisSchema = z.object({
  product_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  price: z.number().finite().min(0).max(10_000_000),
  qty: z.number().int().min(1).max(999),
});

const mulaiQrisSchema = z.object({
  items: z.array(itemQrisSchema).min(1).max(500),
  localNumber: z.string().min(1).max(64),
  deviceId: z.string().min(1).max(128),
});

/**
 * Memulai pembayaran QRIS: menyimpan baris qris_payments + meminta charge
 * ke Midtrans.
 *
 * Karyawan TIDAK boleh menentukan total: total dihitung ULANG di server dari
 * item (sama persis dengan create_transaction). id, kedai, shift, dan
 * karyawan juga dari sesi -- bukan dari perangkat.
 *
 * Transaksi & pengurangan stok BARU terjadi saat pembayaran dikonfirmasi
 * (webhook/polling -> confirm_qris_payment), bukan di sini.
 */
export async function mulaiQris(args: unknown): Promise<HasilMulaiQris> {
  const session = await getPosSession();
  if (!session) return { error: "Sesi kasir berakhir. Pindai kartu lagi." };

  const parsed = mulaiQrisSchema.safeParse(args);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Keranjang tidak valid." };
  }

  // Toko harus terbuka dulu -- QRIS dikunci ke shift yang sedang berjalan.
  // Kalau shift tertutup di tengah pembayaran, transaksinya tetap menempel
  // ke shift tadi (QRIS tidak memengaruhi kas tunai, lihat 0012_*).
  const shift = await getOpenShift(session.kedaiId);
  if (!shift) return { error: "Toko belum dibuka. Buka toko dulu di menu Shift." };

  const total = parsed.data.items.reduce(
    (s, i) => s + i.price * i.qty,
    0,
  );

  if (total <= 0) return { error: "Total pembayaran harus lebih dari nol." };
  if (total > 100_000_000) {
    return { error: "Total terlalu besar untuk dibayar dengan QRIS." };
  }

  const db = createAdminClient();

  const id = crypto.randomUUID();
  const orderId = `POS-${id}`;
  const expiresAt = new Date(Date.now() + QRIS_EXPIRY_MENIT * 60_000);

  const { error: insertError } = await db.from("qris_payments").insert({
    id,
    kedai_id: session.kedaiId,
    shift_id: shift.id,
    employee_id: session.employeeId,
    local_number: parsed.data.localNumber,
    device_id: parsed.data.deviceId,
    items: parsed.data.items,
    total,
    midtrans_order_id: orderId,
    expires_at: expiresAt.toISOString(),
  });

  if (insertError) {
    return { error: `Gagal menyimpan pembayaran: ${insertError.message}` };
  }

  const charge = await chargeQris(orderId, total);

  const { error: updateError } = await db
    .from("qris_payments")
    .update({
      qr_content: charge.qrContent,
      qr_image_url: charge.qrImageUrl,
      expires_at: charge.expiresAt.toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    // QR tidak tersimpan -> tidak terlihat di layar. Batalkan agar tidak
    // pernah tertagih tanpa sepengetahuan kasir.
    await db.from("qris_payments").update({ status: "failed" }).eq("id", id);
    return { error: `Gagal menyimpan QR: ${updateError.message}` };
  }

  return {
    error: null,
    id,
    orderId,
    qrContent: charge.qrContent,
    qrImageUrl: charge.qrImageUrl,
    expiresAt: charge.expiresAt.toISOString(),
    total,
  };
}