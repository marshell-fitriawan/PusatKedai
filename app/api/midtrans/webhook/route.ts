import { NextResponse } from "next/server";
import { z } from "zod";
import { rekapStatus, verifikasiWebhook } from "@/lib/payment/midtrans";
import { laporkanStatusQris } from "@/lib/payment/settle-qris";

/**
 * Webhook notifikasi Midtrans (M1-11).
 *
 * Alur verifikasi:
 *   1. Signature cocok (sha512 order_id+status_code+gross_amount+server_key)
 *      -- kalau tidak, notifikasi dibuang (401). Ini satu-satunya pintu; tanpa
 *      sesi app apa pun karena yang menelepon adalah Midtrans, bukan browser.
 *   2. order_id harus milik kami ("POS-<uuid>"); kalau bukan, balas 200 supaya
 *      Midtrans tidak mengulang-ulang noise.
 *   3. gross_amount diperiksa terhadap total tersimpan (jumlah_tidak_cocok -> 400).
 *   4. status 'settlement' -> confirm_qris_payment (idempoten). Tidak perlu
 *      perangkat kasir online; polling hanyalah cadangan webhook.
 */
const webhookSchema = z.object({
  order_id: z.string().min(1),
  status_code: z.string().min(1),
  gross_amount: z.string().min(1),
  signature_key: z.string().min(1),
  transaction_status: z.string().optional(),
  transaction_time: z.string().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const {
    order_id,
    status_code,
    gross_amount,
    signature_key,
    transaction_status,
    transaction_time,
  } = parsed.data;

  if (
    !verifikasiWebhook({
      orderId: order_id,
      statusCode: status_code,
      grossAmount: gross_amount,
      signatureKey: signature_key,
    })
  ) {
    return NextResponse.json(
      { ok: false, error: "Signature tidak sah" },
      { status: 401 },
    );
  }

  // order_id kami = "POS-<uuid pembayaran>". Format lain = bukan milik kami.
  const paymentId = order_id.startsWith("POS-")
    ? order_id.slice("POS-".length)
    : null;

  if (!paymentId) {
    return NextResponse.json({ ok: false });
  }

  // Waktu bayar dari Midtrans dipakai sebagai created_at transaksi; kalau
  // tidak terkirim/rusak, pakai sekarang.
  let paidAt: Date;
  const parsedTime = Date.parse(transaction_time ?? "");
  if (!Number.isNaN(parsedTime)) {
    paidAt = new Date(parsedTime);
  } else {
    paidAt = new Date();
  }

  const hasil = await laporkanStatusQris(
    paymentId,
    rekapStatus(transaction_status ?? ""),
    paidAt,
    gross_amount,
  );

  switch (hasil.status) {
    case "jumlah_tidak_cocok":
      // Nominal beda: jangan diproses. Midtrans boleh retry menunggu db
      // konsisten -- tapi praktiknya ini sinyal ada yang salah di pos kita.
      return NextResponse.json(
        { ok: false, error: "Nominal tidak cocok dengan pemesanan" },
        { status: 400 },
      );
    case "not_found":
      // Tanda tangan sah tapi order tidak ada: bukan urusan kita, jangan
      // ganggu Midtrans dengan retry yang tidak akan pernah berubah.
      return NextResponse.json({ ok: false });
    case "failed":
      // Gagal memproses (mis. koneksi DB). Kembalikan 5xx supaya Midtrans
      // mengulang -- jangan biarkan pembayaran hilang diam-diam.
      return NextResponse.json(
        { ok: false, error: "Gagal memproses pembayaran" },
        { status: 500 },
      );
    default:
      return NextResponse.json({ ok: true, status: hasil.status });
  }
}