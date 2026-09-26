import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ChevronLeft } from "lucide-react";
import { PrintButton } from "@/components/ui/print-button";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Kartu QR Karyawan" };

/**
 * Kartu QR karyawan (M3-2).
 *
 * Diklik dari daftar karyawan. Token yang dicetak adalah `qr_token` dari
 * database -- persis nilai yang dicocokkan `mulaiSesi()` di /pos/masuk.
 * QR dibuat server-side (paket `qrcode`) supaya kartu tetap bisa dicetak
 * offline dan tanpa memanggil API pihak ketiga.
 */
export default async function KartuQrPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const { data: karyawan } = await supabase
    .from("employees")
    .select("name, role, qr_token, kedai:kedai_id(name, is_active)")
    .eq("id", id)
    .maybeSingle();

  if (!karyawan) notFound();

  if (!karyawan.kedai) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Kartu QR</h1>
        <p role="alert" className="border-2 border-ink bg-danger p-4 text-sm font-semibold text-ink">
          Kedai karyawan ini tidak ditemukan.
        </p>
      </div>
    );
  }

  const qr = await QRCode.toDataURL(karyawan.qr_token, {
    width: 240,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#2b231c", light: "#ffffff" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/admin/karyawan"
          className="inline-flex items-center gap-1 text-sm font-semibold text-text-secondary hover:text-ink"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Kembali
        </Link>
        <PrintButton />
      </div>

      <div className="print-area">
        <Card className="mx-auto max-w-xs p-6 text-center">
          <h1 className="text-xl font-bold">{karyawan.name}</h1>
          <p className="text-sm text-text-secondary">{karyawan.kedai.name}</p>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt={`Kode QR karyawan ${karyawan.name}`}
            className="mx-auto mt-4 size-56"
          />

          <p className="mt-4 text-xs text-text-secondary">
            Pindai di halaman kasir untuk masuk. Kode di bawah dipakai bila
            kamera tidak bisa membaca.
          </p>
          <p className="mt-1 text-sm font-semibold break-all">{karyawan.qr_token}</p>
        </Card>
      </div>
    </div>
  );
}