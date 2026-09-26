import { StokScreen } from "@/components/pos/stok-screen";
import { getPosSession } from "@/lib/pos/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Stok Kedai" };

export default async function PosStokPage() {
  const session = await getPosSession();
  if (!session) return null;

  const db = createAdminClient();

  const [kedaiRes, stokRes, kedaiLainRes, mutasiRes] = await Promise.all([
    db
      .from("kedai")
      .select("id, name, timezone, low_stock_threshold")
      .eq("id", session.kedaiId)
      .maybeSingle(),
    db
      .from("kedai_stock")
      .select("product_id, quantity, product:product_id(name)")
      .eq("kedai_id", session.kedaiId)
      .order("product(name)"),
    db
      .from("kedai")
      .select("id, name")
      .eq("is_active", true)
      .neq("id", session.kedaiId)
      .order("name"),
    db
      .from("stock_mutations")
      .select(
        "id, quantity, status, requested_at, note, created_at, product:product_id(name), tujuan:to_kedai_id(name)",
      )
      .eq("from_kedai_id", session.kedaiId)
      .order("requested_at", { ascending: false })
      .limit(20),
  ]);

  if (kedaiRes.error || !kedaiRes.data) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Stok</h1>
        <p role="alert" className="border-2 border-ink bg-danger p-4 text-sm font-semibold text-ink">
          Gagal memuat data kedai: {kedaiRes.error?.message ?? "kedai tidak ditemukan"}
        </p>
      </div>
    );
  }

  return (
    <StokScreen
      kedai={kedaiRes.data}
      baris={(stokRes.data ?? []) as BarisStok[]}
      kedaiTujuan={(kedaiLainRes.data ?? []) as { id: string; name: string }[]}
      mutasi={(mutasiRes.data ?? []) as BarisMutasi[]}
    />
  );
}

export type BarisStok = {
  product_id: string;
  quantity: number;
  product: { name: string } | null;
};

export type BarisMutasi = {
  id: string;
  quantity: number;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  note: string | null;
  product: { name: string } | null;
  tujuan: { name: string } | null;
};