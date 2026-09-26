import { StokList } from "@/components/admin/stok-list";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Stok — Admin Pusat" };

export default async function StokPage({
  searchParams,
}: {
  searchParams: Promise<{ kedai?: string }>;
}) {
  const supabase = await createClient();

  const { data: daftarKedai, error: errKedai } = await supabase
    .from("kedai")
    .select("id, name, is_warehouse, low_stock_threshold")
    .eq("is_active", true)
    .order("name");

  if (errKedai) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Stok</h1>
        <p role="alert" className="border-2 border-ink bg-danger p-4 text-sm font-semibold text-ink">
          Gagal memuat kedai: {errKedai.message}
        </p>
      </div>
    );
  }

  if (!daftarKedai || daftarKedai.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Stok</h1>
        <p className="text-sm text-text-secondary">
          Belum ada kedai aktif. Tambahkan cabang dulu di menu Kedai.
        </p>
      </div>
    );
  }

  const { kedai } = await searchParams;
  const terpilih = daftarKedai.find((k) => k.id === kedai) ?? daftarKedai[0];

  // Katalog produk shared, stok per kedai. Produk yang belum punya baris stok
  // tetap ditampilkan dengan 0 -- kalau disembunyikan, admin tidak punya cara
  // mengisi stok awalnya.
  const [produkRes, stokRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, category")
      .eq("is_active", true)
      .order("category", { nullsFirst: false })
      .order("name"),
    supabase
      .from("kedai_stock")
      .select("product_id, quantity, updated_at")
      .eq("kedai_id", terpilih.id),
  ]);

  const gagal = produkRes.error ?? stokRes.error;
  if (gagal) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Stok</h1>
        <p role="alert" className="border-2 border-ink bg-danger p-4 text-sm font-semibold text-ink">
          Gagal memuat stok: {gagal.message}
        </p>
      </div>
    );
  }

  const peta = new Map(
    (stokRes.data ?? []).map((s) => [s.product_id, s]),
  );

  const baris = (produkRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    quantity: peta.get(p.id)?.quantity ?? 0,
    belumDiatur: !peta.has(p.id),
  }));

  // M6-6: ringkasan stok mentah (bahan hanya di gudang pusat) di atas stok jadi
  // per kedai -- dua lapis stok tampil jelas di satu halaman.
  const [bahanRes, stokBahanRes] = await Promise.all([
    supabase
      .from("bahan_mentah")
      .select("id")
      .eq("is_active", true),
    supabase.from("bahan_stock").select("bahan_id, quantity"),
  ]);
  const petaBahan = new Map(
    (stokBahanRes.data ?? []).map((s) => [s.bahan_id, s.quantity]),
  );
  const ambangBahan =
    daftarKedai.find((k) => k.is_warehouse)?.low_stock_threshold ?? 5;
  const bahan = (bahanRes.data ?? []).map((b) => petaBahan.get(b.id) ?? 0);
  const bahanHabis = bahan.filter((q) => q <= 0).length;
  const bahanMenipis = bahan.filter(
    (q) => q > 0 && q <= ambangBahan,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <a
        href="/admin/bahan"
        className="flex flex-wrap items-center justify-between gap-2 border-2 border-ink bg-surface p-4 shadow-brutal press-brutal hover:bg-primary-light"
      >
        <div>
          <h2 className="text-sm font-bold">Stok bahan mentah (gudang)</h2>
          <p className="text-xs text-text-secondary">
            Kelola bahan, produksi, dan ambang menipis di halaman Bahan Mentah.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <span
            title="Bahan habis atau minus"
            className={`tabular-nums font-semibold ${bahanHabis > 0 ? "text-danger-text" : "text-text-secondary"}`}
          >
            {bahanHabis} habis
          </span>
          <span
            title={`Bahan di bawah ambang menipis (${ambangBahan})`}
            className={`tabular-nums font-semibold ${bahanMenipis > 0 ? "text-warning-text" : "text-text-secondary"}`}
          >
            {bahanMenipis} menipis
          </span>
        </div>
      </a>

      <StokList
        daftarKedai={daftarKedai}
        kedaiTerpilih={terpilih}
        baris={baris}
      />
    </div>
  );
}
