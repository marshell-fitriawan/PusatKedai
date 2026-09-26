import { ProduksiRun } from "@/components/admin/produksi-run";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Produksi — Admin Pusat" };

export default async function ProduksiPage() {
  const supabase = await createClient();

  const [produkRes, bahanRes, stokRes, gudangRes, riwayatRes] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, price")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("bahan_mentah")
        .select("id, name, satuan")
        .eq("is_active", true)
        .order("name"),
      supabase.from("bahan_stock").select("bahan_id, quantity"),
      supabase
        .from("kedai")
        .select("id, name")
        .eq("is_warehouse", true)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("produksi")
        .select(
          "id, product_id, qty_hasil, produced_at, note, products(name), produksi_bahan(bahan_id, qty)",
        )
        .order("produced_at", { ascending: false })
        .limit(50),
    ]);

  const gagal =
    produkRes.error ??
    bahanRes.error ??
    stokRes.error ??
    gudangRes.error ??
    riwayatRes.error;

  if (gagal) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Produksi</h1>
        <p role="alert" className="border-2 border-ink bg-danger p-4 text-sm font-semibold text-ink">
          Gagal memuat data produksi: {gagal.message}
        </p>
      </div>
    );
  }

  const petaStok = new Map(
    (stokRes.data ?? []).map((s) => [s.bahan_id, s.quantity]),
  );

  return (
    <ProduksiRun
      produk={produkRes.data ?? []}
      bahan={(bahanRes.data ?? []).map((b) => ({
        id: b.id,
        name: b.name,
        satuan: b.satuan,
        stok: petaStok.get(b.id) ?? 0,
      }))}
      gudang={gudangRes.data}
      riwayat={(riwayatRes.data ?? []).map((r) => ({
        id: r.id,
        product_name: r.products?.name ?? "—",
        qty_hasil: r.qty_hasil,
        produced_at: r.produced_at,
        note: r.note,
        bahan: r.produksi_bahan,
      }))}
    />
  );
}