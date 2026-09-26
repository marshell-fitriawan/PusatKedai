import "server-only";

import { createHash } from "node:crypto";

/**
 * Klien Midtrans untuk pembayaran QRIS (M1-10, M1-11).
 *
 * PROVIDER GANDA
 *   * mode MIDTRANS AKTIF: `MIDTRANS_SERVER_KEY` terisi -> memanggil API
 *     Midtrans asli (charge v1, status v2) lewat Basic Auth.
 *   * mode MOCK: key kosong (klien belum punya akun berbayar) -> semua
 *     diputar di memori server. QR tetap dihasilkan, dan pembayaran "lunas"
 *     otomatis ~15 detik setelah charge tanpa harus pindai beneran.
 *
 *   Mode MOCK dipakai untuk demo & uji alur end-to-end sampai akun Midtrans
 *   klien tersedia. Konfigurasi asli (MIDTRANS_SERVER_KEY) tinggal diisi di
 *   .env.local dan semua bagian ini beralih ke API sungguhan -- tidak ada
 *   path kode yang menebak-nebak lagi.
 *
 *   PENGAMAN PRODUCTION: kalau NODE_ENV=production dan MIDTRANS_SERVER_KEY
 *   kosong, chargeQris/statusQris melempar error dan verifikasi webhook
 *   selalu menolak. Alasan: mode mock menganggap pembayaran "lunas" otomatis
 *   15 detik setelah charge -- di production itu pembayaran palsu yang masuk
 *   laporan. Jangan pernah menonaktifkan pengaman ini.
 *
 *   Catatan: state mock disimpan di memori satu proses server. Ini cukup
 *   untuk kasir (satu perangkat), TIDAK untuk serangan lintas restart.
 *   Ingat juga: file ini "server-only" -- tidak boleh ikut ke bundle client.
 */

const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY ?? "";
const IS_SANDBOX = process.env.MIDTRANS_ENV === "sandbox";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Mode mock hanya untuk development & demo. Di production, QRIS tanpa
 * MIDTRANS_SERVER_KEY tidak boleh berjalan: mode mock menganggap pembayaran
 * "lunas" otomatis ~15 detik setelah charge -- itu pembayaran palsu yang
 * akan ikut masuk laporan omzet.
 */
function pastikanModeAsliAtauDev(): void {
  if (!MIDTRANS_AKTIF && IS_PRODUCTION) {
    throw new Error(
      "MIDTRANS_SERVER_KEY kosong di production -- pembayaran QRIS dinonaktifkan. Isi key di env atau jangan tawarkan QRIS ke pelanggan.",
    );
  }
}

/** Mode asli jalan kalau key server terisi. Kalau kosong -> mock. */
export const MIDTRANS_AKTIF = SERVER_KEY.length > 0;

/**
 * Key sementara untuk memverifikasi webhook di mode mock (untuk uji curl).
 * Hanya dipakai kalau MIDTRANS_SERVER_KEY kosong -- dalam mode asli key
 * asli yang dipakai dan dia yang diverifikasi.
 */
export const MOCK_SERVER_KEY = "SB-Mid-server-MOCK-0000000000000000";

/** Berapa menit QR berlaku sebelum kedaluwarsa (custom_expiry ke Midtrans). */
export const QRIS_EXPIRY_MENIT = 5;

const CHARGE_HOST = IS_SANDBOX
  ? "https://app.sandbox.midtrans.com"
  : "https://app.midtrans.com";

const STATUS_HOST = IS_SANDBOX
  ? "https://api.sandbox.midtrans.com"
  : "https://api.midtrans.com";

/** Status pembayaran yang bisa dibandingkan kode app dengan Midtrans. */
export type StatusMidtrans =
  | "pending"
  | "settlement"
  | "expire"
  | "cancel"
  | "deny"
  | "failure"
  | "unknown";

/** Normalisasi transaction_status dari API maupun webhook Midtrans. */
export function rekapStatus(raw: string): StatusMidtrans {
  switch (raw.toLowerCase()) {
    case "settlement":
    case "capture":
      return "settlement";
    case "pending":
    case "challenge":
      return "pending";
    case "expire":
      return "expire";
    case "cancel":
      return "cancel";
    case "deny":
      return "deny";
    case "failure":
      return "failure";
    default:
      return "unknown";
  }
}

export type HasilChargeQris = {
  /** String EMVCo (atau mock) yang dirender menjadi QR di perangkat kasir. */
  qrContent: string;
  /** Alternatif gambar QR langsung dari Midtrans (nullable). */
  qrImageUrl: string | null;
  expiresAt: Date;
};

function basicAuth(): string {
  return `Basic ${Buffer.from(`${SERVER_KEY}:`).toString("base64")}`;
}

function cekRespon(response: Response, body: Record<string, unknown>): never | void {
  if (response.ok) return;
  const pesan =
    typeof body.status_message === "string" && body.status_message
      ? body.status_message
      : `HTTP ${response.status}`;
  throw new Error(`Midtrans: ${pesan}`);
}

// ---------------------------------------------------------------------
// Mock (mode tanpa key) -- lihat penjelasan atas file.
// ---------------------------------------------------------------------
const mockStore = new Map<
  string,
  { total: number; createdAt: number; expiresAt: number }
>();

const MOCK_SETTLE_MS = 15_000;

function mockChargeQris(orderId: string, total: number): HasilChargeQris {
  const now = Date.now();
  const expiresAt = now + QRIS_EXPIRY_MENIT * 60_000;
  mockStore.set(orderId, { total, createdAt: now, expiresAt });
  return {
    qrContent: JSON.stringify({ mock: true, orderId, total }),
    qrImageUrl: null,
    expiresAt: new Date(expiresAt),
  };
}

function mockStatusQris(orderId: string): StatusMidtrans {
  const row = mockStore.get(orderId);
  if (!row) return "unknown";

  if (Date.now() > row.expiresAt) return "expire";
  if (Date.now() - row.createdAt >= MOCK_SETTLE_MS) return "settlement";
  return "pending";
}

// ---------------------------------------------------------------------
// API publik yang dipakai server action & route
// ---------------------------------------------------------------------
export function midtransAktif(): boolean {
  return MIDTRANS_AKTIF;
}

/**
 * Minta QRIS charge ke Midtrans.
 * orderId berbentuk "POS-<uuid>" -- unik dan bisa dicari lagi di webhook
 * maupun status API. totalRupiah dihitung ULANG di server (lihat 0012_*).
 */
export async function chargeQris(
  orderId: string,
  totalRupiah: number,
): Promise<HasilChargeQris> {
  pastikanModeAsliAtauDev();
  if (!MIDTRANS_AKTIF) return mockChargeQris(orderId, totalRupiah);

  const res = await fetch(`${CHARGE_HOST}/v1/charge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: basicAuth(),
    },
    body: JSON.stringify({
      payment_type: "qris",
      transaction_details: {
        order_id: orderId,
        gross_amount: totalRupiah.toFixed(2),
      },
      custom_expiry: {
        expiry_duration: QRIS_EXPIRY_MENIT,
        unit: "minutes",
      },
    }),
  });

  const body = (await res.json()) as Record<string, unknown> & {
    actions?: Array<{ name?: string; method?: string; url?: string }>;
  };
  cekRespon(res, body);

  const aksi = Array.isArray(body.actions) ? body.actions : [];
  const aksiQr = aksi.find(
    (a) =>
      /qr/i.test(a.name ?? "") ||
      /qr/i.test(a.method ?? "") ||
      String(a.url ?? "").toLowerCase().includes("qris"),
  );

  return {
    qrContent: aksiQr?.url ?? (typeof body.qr_content === "string" ? body.qr_content : null) ?? "",
    qrImageUrl: typeof body.qr_url === "string" ? body.qr_url : null,
    expiresAt: new Date(Date.now() + QRIS_EXPIRY_MENIT * 60_000),
  };
}

/** Status dari Midtrans untuk sebuah order. Dipakai polling kasir. */
export async function statusQris(orderId: string): Promise<StatusMidtrans> {
  pastikanModeAsliAtauDev();
  if (!MIDTRANS_AKTIF) return mockStatusQris(orderId);

  const res = await fetch(
    `${STATUS_HOST}/v2/${encodeURIComponent(orderId)}/status`,
    { headers: { Accept: "application/json", Authorization: basicAuth() } },
  );

  if (res.status === 404) return "unknown";

  const body = (await res.json()) as { transaction_status?: string };
  return rekapStatus(body.transaction_status ?? "");
}

/**
 * Verifikasi signature webhook Midtrans.
 *
 * Doc resmi: signature_key = sha512(order_id + status_code + gross_amount +
 * server_key) DISAMBUNG TANPA SEPARATOR. Kalau tidak cocok, notifikasi itu
 * bukan dari Midtrans dan harus dibuang.
 */
export function verifikasiWebhook(params: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}): boolean {
  // Di production tanpa key asli, signature apa pun ditolak -- tak ada jalan
  // verifikasi yang sah. Kalau key kosong, mode mock tidak berlaku di production.
  if (!MIDTRANS_AKTIF && IS_PRODUCTION) return false;
  const key = SERVER_KEY || MOCK_SERVER_KEY;
  const hash = createHash("sha512")
    .update(`${params.orderId}${params.statusCode}${params.grossAmount}${key}`)
    .digest("hex");
  return hash === params.signatureKey;
}