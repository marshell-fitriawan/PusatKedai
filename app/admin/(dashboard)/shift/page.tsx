import { ShiftList } from "@/components/admin/shift-list";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Buka Tutup — Admin Pusat" };

export default async function ShiftPage({
  searchParams,
}: {
  searchParams: Promise<{ kedai?: string; dari?: string; sampai?: string }>;
}) {
  const supabase = await createClient();

  const [{ kedai, dari, sampai }, kedaiRes] = await Promise.all([
    searchParams,
    supabase
      .from("kedai")
      .select("id, name")
      .order("name"),
  ]);

  let query = supabase
    .from("shifts")
    .select(
      `id, business_date, opening_cash, closing_cash, expected_cash, cash_difference,
       reconciliation_status, pending_sync_count, status, opened_at, closed_at,
       kedai:kedai_id(name), pembuka:opened_by(name), penutup:closed_by(name)`,
    )
    .order("opened_at", { ascending: false })
    .limit(100);

  if (kedai) query = query.eq("kedai_id", kedai);
  if (dari) query = query.gte("business_date", dari);
  if (sampai) query = query.lte("business_date", sampai);

  const [shiftRes] = await Promise.all([query]);

  const gagal = kedaiRes.error ?? shiftRes.error;
  if (gagal) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Buka Tutup</h1>
        <p role="alert" className="border-2 border-ink bg-danger p-4 text-sm font-semibold text-ink">
          Gagal memuat data: {gagal.message}
        </p>
      </div>
    );
  }

  return (
    <ShiftList
      daftarKedai={kedaiRes.data ?? []}
      kedaiTerpilih={kedai ?? ""}
      dari={dari ?? ""}
      sampai={sampai ?? ""}
      shift={(shiftRes.data ?? []) as ShiftItem[]}
    />
  );
}

export type ShiftItem = {
  id: string;
  business_date: string;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  cash_difference: number | null;
  reconciliation_status: "pending_sync" | "final";
  pending_sync_count: number;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  kedai: { name: string } | null;
  pembuka: { name: string } | null;
  penutup: { name: string } | null;
};