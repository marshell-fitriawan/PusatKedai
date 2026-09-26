import { NextResponse } from "next/server";
import { getPosSession } from "@/lib/pos/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { statusQris } from "@/lib/payment/midtrans";
import { laporkanStatusQris } from "@/lib/payment/settle-qris";

/**
 * Status pembayaran QRIS untuk polling kasir (M1-10).
 *
 * Kenapa ROUTE HANDLER bukan server action: polling berjalan di timer
 * JavaScript biasa (setInterval di kasir-screen), tanpa konteks React --
 * konvensi yang sama dengan endpoint sync transaksi.
 *
 * Siklus hidup polling masih berpusat di database: row qris_payments yang
 * sudah 'paid'/'expired'/'failed' langsung dijawab dari DB tanpa menelepon
 * Midtrans lagi. Hanya yang masih 'created' yang diteruskan ke status API
 * (atau mock) lalu diselesaikan lewat laporkanStatusQris.
 */
export async function GET(request: Request) {
  const session = await getPosSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sesi kasir tidak ditemukan" },
      { status: 401 },
    );
  }

  const paymentId = new URL(request.url).searchParams.get("paymentId");
  if (!paymentId) {
    return NextResponse.json({ error: "paymentId wajib diisi" }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: payment, error } = await db
    .from("qris_payments")
    .select("id, status, midtrans_order_id, total, expires_at")
    .eq("id", paymentId)
    .maybeSingle();

  if (error || !payment) {
    return NextResponse.json({ error: "Pembayaran tidak dikenal" }, { status: 404 });
  }

  if (
    payment.status === "paid" ||
    payment.status === "expired" ||
    payment.status === "failed"
  ) {
    const { data: tx } = await db
      .from("transactions")
      .select("transaction_number, total")
      .eq("id", paymentId)
      .maybeSingle();

    if (payment.status === "paid" && tx) {
      return NextResponse.json({
        status: "paid",
        transactionNumber: tx.transaction_number,
        total: Number(tx.total),
      });
    }
    return NextResponse.json({ status: payment.status });
  }

  const hasilMidtrans = await statusQris(payment.midtrans_order_id);
  const hasil = await laporkanStatusQris(payment.id, hasilMidtrans, new Date());

  if (hasil.status === "paid") {
    return NextResponse.json({
      status: "paid",
      transactionNumber: hasil.transactionNumber,
      total: hasil.total,
    });
  }

  if (hasil.status === "pending") {
    return NextResponse.json({
      status: "pending",
      expiresAt: payment.expires_at,
    });
  }

  return NextResponse.json({ status: hasil.status });
}