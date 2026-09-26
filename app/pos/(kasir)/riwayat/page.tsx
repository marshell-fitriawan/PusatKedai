import { redirect } from "next/navigation";
import { RiwayatList } from "@/components/pos/riwayat-list";
import { getPosSession } from "@/lib/pos/session";
import { businessDate, getOpenShift } from "@/lib/pos/shift";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Riwayat" };

export default async function RiwayatPage({
  searchParams,
}: {
  searchParams: Promise<{ tgl?: string }>;
}) {
  const session = await getPosSession();
  if (!session) redirect("/pos/masuk");

  const db = createAdminClient();

  const { data: kedai } = await db
    .from("kedai")
    .select("timezone")
    .eq("id", session.kedaiId)
    .maybeSingle();

  const tz = kedai?.timezone ?? "Asia/Kuala_Lumpur";
  const { tgl } = await searchParams;
  // Default hari ini menurut zona kedai, bukan tanggal server.
  const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(tgl ?? "") ? tgl! : businessDate(tz);

  // Filter kedai_id WAJIB: service role melewati RLS, jadi tanpa ini kasir
  // kedai A akan melihat transaksi kedai B.
  const { data, error } = await db
    .from("transactions")
    .select(
      "id, transaction_number, local_number, total, payment_method, status, created_at, transaction_items(product_name_snapshot, price_snapshot, qty, subtotal)",
    )
    .eq("kedai_id", session.kedaiId)
    .eq("business_date", tanggal)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Riwayat</h1>
        <p role="alert" className="border-2 border-ink bg-danger p-4 text-sm font-semibold text-ink">
          Gagal memuat riwayat: {error.message}
        </p>
      </div>
    );
  }

  const shift = await getOpenShift(session.kedaiId);

  return (
    <RiwayatList
      data={data ?? []}
      tanggal={tanggal}
      hariIni={businessDate(tz)}
      adaShiftTerbuka={shift !== null}
    />
  );
}
