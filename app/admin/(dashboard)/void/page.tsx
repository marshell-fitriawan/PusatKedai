import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  VoidReviewList,
  type BarisReview,
} from "@/components/admin/void-review-list";

export const metadata = { title: "Pembatalan — menunggu keputusan" };

export const dynamic = "force-dynamic";

/**
 * Daftar pengajuan pembatalan yang belum diputuskan (M8-1).
 *
 * Kasir tidak lagi membatalkan transaksi langsung: pengajuan muncul di sini
 * dan stok tetap utuh sampai pemilik menetapkan keputusan. Setuju -> transaksi
 * dibatalkan + stok kembali via ledger; Tolak (wajib alasan) -> transaksi
 * tetap completed.
 */
export default async function VoidPage() {
  await requireAdmin();
  const db = createAdminClient();

  const { data: requests } = await db
    .from("void_request")
    .select(
      "*, transactions:transaction_id(id, transaction_number, local_number, total, created_at, shift_id), employees:requested_by_employee_id(name), kedai:kedai_id(name)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  const baris: BarisReview[] = (requests ?? []).map((r) => {
    const txRaw = r.transactions as {
      transaction_number: string | null;
      local_number: string;
      total: number;
      created_at: string;
    } | null;
    const emRaw = r.employees as { name: string } | null;
    const kedaiRaw = r.kedai as { name: string } | null;
    return {
      requestId: r.id,
      transactionNumber: txRaw?.transaction_number ?? txRaw?.local_number ?? "-",
      kedai: kedaiRaw?.name ?? "Kedai",
      employee: emRaw?.name ?? "Karyawan",
      total: Number(txRaw?.total ?? 0),
      waktu: txRaw?.created_at ?? r.created_at,
      alasan: r.alasan,
    };
  });

  if (baris.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Pembatalan menunggu keputusan</h1>
        <p className="text-text-secondary">
          Tidak ada pengajuan pembatalan yang menunggu keputusan. Pengajuan
          muncul di sini saat kasir meminta membatalkan transaksi — stok tidak
          dikembalikan sampai Anda setujui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Pembatalan menunggu keputusan</h1>
      <p className="text-sm text-text-secondary">
        Putusan Anda atas {baris.length} pengajuan pembatalan. Setujui →
        transaksi dibatalkan &amp; stok kembali; tolak → transaksi tetap sah
        (wajib isi alasan, jadi jejak keputusan).
      </p>
      <VoidReviewList baris={baris} />
    </div>
  );
}