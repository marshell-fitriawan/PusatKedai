import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { StatusMidtrans } from "@/lib/payment/midtrans";

export type HasilLaporQris = {
  status: "paid" | "expired" | "failed" | "pending" | "not_found" | "jumlah_tidak_cocok";
  transactionNumber?: string;
  total?: number;
};

/**
 * Satu-satunya jembatan antara "hasil konfirmasi dari Midtrans" dengan basis
 * data -- dipakai webhook DAN polling kasir supaya keduanya tidak bisa
 * berbeda pendapat soal status pembayaran yang sama.
 *
 *   settlement -> confirm_qris_payment(id, paidAt) -> 'paid'
 *   expire/cancel/deny/failure -> tandai 'expired'/'failed' (hanya dari status
 *   'created') -> dikembalikan apa adanya
 *   selain itu -> 'pending'
 *
 * grossAmount (opsional, dipakai webhook) dicocokkan dulu dengan total yang
 * tersimpan; kalau berbeda, pembayaran TIDAK diproses.
 */
export async function laporkanStatusQris(
  paymentId: string,
  statusMidtrans: StatusMidtrans,
  paidAt: Date,
  grossAmount?: string,
): Promise<HasilLaporQris> {
  const db = createAdminClient();

  const { data, error } = await db
    .from("qris_payments")
    .select("id, status, total")
    .eq("id", paymentId)
    .maybeSingle();

  if (error || !data) return { status: "not_found" };

  if (grossAmount !== undefined) {
    const sesuai =
      Math.abs(Number(grossAmount) - Number(data.total)) < 0.005;
    if (!sesuai) return { status: "jumlah_tidak_cocok" };
  }

  // Sudah dibayar -- kembalikan apa adanya (webhook kedua/ttl duble safe).
  if (data.status === "paid") {
    const { data: tx } = await db
      .from("transactions")
      .select("transaction_number, total")
      .eq("id", paymentId)
      .maybeSingle();

    return tx
      ? {
          status: "paid",
          transactionNumber: tx.transaction_number ?? undefined,
          total: Number(tx.total),
        }
      : { status: "paid" };
  }

  if (data.status === "expired" || data.status === "failed") {
    return { status: data.status };
  }

  if (statusMidtrans === "settlement") {
    const { data: hasil, error: rpcError } = await db.rpc(
      "confirm_qris_payment",
      { p_payment_id: paymentId, p_paid_at: paidAt.toISOString() },
    );

    if (rpcError || !hasil?.[0]) {
      return { status: "failed" };
    }

    return {
      status: "paid",
      transactionNumber: hasil[0].transaction_number,
      total: Number(hasil[0].total),
    };
  }

  if (
    statusMidtrans === "expire" ||
    statusMidtrans === "cancel" ||
    statusMidtrans === "deny" ||
    statusMidtrans === "failure"
  ) {
    const statusBaru: "expired" | "failed" =
      statusMidtrans === "failure" || statusMidtrans === "deny"
        ? "failed"
        : "expired";

    await db.from("qris_payments").update({ status: statusBaru }).eq("id", paymentId);

    return { status: statusBaru };
  }

  return { status: "pending" };
}