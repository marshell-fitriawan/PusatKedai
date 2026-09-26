import { BahanList } from "@/components/admin/bahan-list";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Bahan Mentah — Admin Pusat" };

export default async function BahanPage() {
  const supabase = await createClient();

  const [bahanRes, stokRes, gudangRes] = await Promise.all([
    supabase
      .from("bahan_mentah")
      .select("*")
      .order("is_active", { ascending: false })
      .order("name"),
    supabase.from("bahan_stock").select("bahan_id, quantity"),
    supabase
      .from("kedai")
      .select("id, name, low_stock_threshold")
      .eq("is_warehouse", true)
      .limit(1)
      .maybeSingle(),
  ]);

  const gagal = bahanRes.error ?? stokRes.error ?? gudangRes.error;
  if (gagal) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Bahan Mentah</h1>
        <p role="alert" className="border-2 border-ink bg-danger p-4 text-sm font-semibold text-ink">
          Gagal memuat bahan: {gagal.message}
        </p>
      </div>
    );
  }

  const peta = new Map((stokRes.data ?? []).map((s) => [s.bahan_id, s.quantity]));

  const baris = (bahanRes.data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    satuan: b.satuan,
    harga_beli: b.harga_beli,
    is_active: b.is_active,
    quantity: peta.get(b.id) ?? 0,
  }));

  return (
    <BahanList
      baris={baris}
      ambangMenipis={gudangRes.data?.low_stock_threshold ?? 5}
      adaGudang={gudangRes.data !== null}
    />
  );
}