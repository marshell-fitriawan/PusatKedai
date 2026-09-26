import { AssignGudang, type StokGudang } from "@/components/admin/assign-gudang";
import { MutasiList } from "@/components/admin/mutasi-list";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Mutasi — Admin Pusat" };

const statusLabel: Record<string, string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
};

export default async function MutasiPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();

  const status = (await searchParams).status ?? "pending";
  const statusAktif: "pending" | "approved" | "rejected" | "" =
    status === "" || ["pending", "approved", "rejected"].includes(status)
      ? (status as "pending" | "approved" | "rejected" | "")
      : "pending";

  const query = supabase
    .from("stock_mutations")
    .select(
      `id, quantity, status, requested_at, note,
       dari:from_kedai_id(name), tujuan:to_kedai_id(name),
       produk:product_id(name), pengaju:requested_by_employee_id(name)`,
    )
    .order("requested_at", { ascending: false })
    .limit(200);

  const filt = statusAktif !== "" ? query.eq("status", statusAktif) : query;
  const { data, error } = await filt;

  const { data: gudang } = await supabase
    .from("kedai")
    .select("id, name")
    .eq("is_warehouse", true)
    .limit(1)
    .maybeSingle();

  const [stokGudangRes, tujuanRes] = await Promise.all([
    supabase
      .from("kedai_stock")
      .select("product_id, quantity, produk:product_id(name)")
      .eq("kedai_id", gudang?.id ?? "")
      .gt("quantity", 0),
    supabase
      .from("kedai")
      .select("id, name")
      .eq("is_warehouse", false)
      .eq("is_active", true)
      .order("name"),
  ]);

  const stokGudang: StokGudang[] = (stokGudangRes.data ?? []).map((s) => ({
    product_id: s.product_id,
    name: s.produk?.name ?? "?",
    quantity: s.quantity,
  }));

  return (
    <div className="flex flex-col gap-6">
      <AssignGudang
        gudang={gudang ?? null}
        stok={gudang ? stokGudang : []}
        tujuan={tujuanRes.data ?? []}
      />

      <MutasiList
        statusTerpilih={statusAktif}
        mutasi={(data ?? []) as MutasiItem[]}
        error={error?.message ?? null}
        statusLabel={statusLabel}
      />
    </div>
  );
}

export type MutasiItem = {
  id: string;
  quantity: number;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  note: string | null;
  dari: { name: string } | null;
  tujuan: { name: string } | null;
  produk: { name: string } | null;
  pengaju: { name: string } | null;
};