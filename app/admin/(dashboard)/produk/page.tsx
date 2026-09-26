import { ProdukList } from "@/components/admin/produk-list";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Produk — Admin Pusat",
};

export default async function ProdukPage() {
  const supabase = await createClient();

  // Produk aktif di atas, lalu dikelompokkan kategori. Urutan ini mengikuti
  // cara admin bekerja: yang sedang dijual jauh lebih sering disentuh
  // daripada yang sudah dipensiunkan.
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("is_active", { ascending: false })
    .order("category", { nullsFirst: false })
    .order("name");

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Produk</h1>
        <p
          role="alert"
          className="border-2 border-ink bg-danger p-4 text-sm font-semibold text-ink"
        >
          Gagal memuat daftar produk: {error.message}
        </p>
      </div>
    );
  }

  return <ProdukList data={data ?? []} />;
}
