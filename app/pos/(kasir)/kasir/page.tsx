import { redirect } from "next/navigation";
import { KasirScreen } from "@/components/pos/kasir-screen";
import { MIDTRANS_AKTIF } from "@/lib/payment/midtrans";
import { getPosSession } from "@/lib/pos/session";
import { getOpenShift } from "@/lib/pos/shift";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "Kasir",
};

export default async function KasirPage() {
  const session = await getPosSession();
  if (!session) redirect("/pos/masuk");

  // Karyawan bukan user Supabase Auth, jadi RLS akan menolak anon key.
  // Akses POS memang lewat service role di server -- dan karena service role
  // MELEWATI RLS, filter kedai_id di bawah wajib ditulis eksplisit.
  // Tanpa itu, kasir kedai A akan melihat stok kedai B.
  const db = createAdminClient();

  const [produkRes, stokRes, kedaiRes] = await Promise.all([
    db
      .from("products")
      .select("id, name, price, category, image_url")
      .eq("is_active", true)
      .order("category", { nullsFirst: false })
      .order("name"),
    db
      .from("kedai_stock")
      .select("product_id, quantity")
      .eq("kedai_id", session.kedaiId),
    db
      .from("kedai")
      .select("low_stock_threshold")
      .eq("id", session.kedaiId)
      .maybeSingle(),
  ]);

  const gagal = produkRes.error ?? stokRes.error;
  if (gagal) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Kasir</h1>
        <p
          role="alert"
          className="border-2 border-ink bg-danger p-4 text-sm font-semibold text-ink"
        >
          Gagal memuat katalog: {gagal.message}
        </p>
      </div>
    );
  }

  const shift = await getOpenShift(session.kedaiId);

  const stokPerProduk = new Map(
    (stokRes.data ?? []).map((s) => [s.product_id, s.quantity]),
  );

  const produk = (produkRes.data ?? []).map((p) => ({
    ...p,
    // Produk tanpa baris stok dianggap 0, bukan disembunyikan -- kasir tetap
    // boleh menjualnya (stok boleh minus, lihat docs/Database.md §7).
    stok: stokPerProduk.get(p.id) ?? 0,
  }));

  return (
    <KasirScreen
      produk={produk}
      ambangStokMenipis={kedaiRes.data?.low_stock_threshold ?? 5}
      kedaiId={session.kedaiId}
      shiftId={shift?.id ?? null}
      qrisAktif={MIDTRANS_AKTIF}
    />
  );
}
