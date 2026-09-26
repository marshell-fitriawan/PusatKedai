import { PengeluaranList, type BarisPengeluaran, type ShiftTerbuka } from "@/components/admin/pengeluaran-list";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Pengeluaran — Admin Pusat" };

export default async function PengeluaranPage({
  searchParams,
}: {
  searchParams: Promise<{ kedai?: string; dari?: string; sampai?: string }>;
}) {
  const supabase = await createClient();

  const [{ kedai, dari, sampai }, kedaiRes, shiftRes] = await Promise.all([
    searchParams,
    supabase.from("kedai").select("id, name").eq("is_active", true).order("name"),
    // Sesi yang masih buka -- untuk pilihan "ambil dari kas" pada form (M8-3).
    supabase
      .from("shifts")
      .select("id, kedai_id, business_date, kedai:kedai_id(name)")
      .eq("status", "open")
      .order("business_date", { ascending: false }),
  ]);

  let query = supabase
    .from("expenses")
    .select(
      "id, category, description, amount, expense_date, kedai:kedai_id(name), shift:shift_id(business_date), from_cash",
    )
    .order("expense_date", { ascending: false })
    .limit(200);

  if (kedai) query = query.eq("kedai_id", kedai);
  if (dari) query = query.gte("expense_date", dari);
  if (sampai) query = query.lte("expense_date", sampai);

  const [expRes] = await Promise.all([query]);

  const gagal = kedaiRes.error ?? expRes.error ?? shiftRes.error;
  if (gagal) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Pengeluaran</h1>
        <p role="alert" className="border-2 border-ink bg-danger p-4 text-sm font-semibold text-ink">
          Gagal memuat pengeluaran: {gagal.message}
        </p>
      </div>
    );
  }

  const baris = (expRes.data ?? []) as BarisPengeluaran[];
  const total = baris.reduce((acc, b) => acc + Number(b.amount), 0);

  return (
    <PengeluaranList
      daftarKedai={kedaiRes.data ?? []}
      daftarShiftTerbuka={(shiftRes.data ?? []) as ShiftTerbuka[]}
      kedaiTerpilih={kedai ?? ""}
      dari={dari ?? ""}
      sampai={sampai ?? ""}
      baris={baris}
      total={total}
    />
  );
}