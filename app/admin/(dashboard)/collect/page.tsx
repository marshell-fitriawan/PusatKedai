import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CollectScreen, type BarisSesi } from "@/components/admin/collect-screen";

export const metadata = { title: "Setoran — Admin Pusat" };

export const dynamic = "force-dynamic";

/**
 * Ambil selisih stok per produk untuk satu shift yang sudah final (M7-4).
 *
 * "Tercatat saat tutup" dihitung ulang dari ledger: saldo terkini
 * kedai_stock dikurangi semua pergerakan setelah shift ditutup. Jadi angka
 * ini tidak terpengaruh waste/mutasi yang terjadi sesudah penutupan.
 *
 * selisih = fisik(kasir) - tercatat_saat_tutup. Negatif berarti kasir
 * menghitung lebih sedikit dari catatan (kemungkinan hilang/tidak tercatat).
 * Tidak memakai angka klaim dari perangkat -- semua dihitung server.
 */
export default async function CollectPage() {
  await requireAdmin();
  const db = createAdminClient();

  const { data: shifts } = await db
    .from("shifts")
    .select("*, kedai:kedai_id(name)")
    .eq("reconciliation_status", "final")
    .order("closed_at", { ascending: false })
    .limit(30);

  const sesi: BarisSesi[] = [];

  for (const shift of shifts ?? []) {
    const kedaiNama =
      (shift as unknown as { kedai?: { name: string } }).kedai?.name ??
      "Kedai";

    const { data: sisa } = await db
      .from("sisa_fisik")
      .select("product_id, quantity")
      .eq("shift_id", shift.id);

    // Tak ada hitungan fisik -> tak ada selisih stok untuk dihitung.
    if (!sisa || sisa.length === 0) {
      sesi.push({
        shiftId: shift.id,
        kedaiNama,
        businessDate: shift.business_date,
        closedAt: shift.closed_at ?? undefined,
        openingCash: Number(shift.opening_cash),
        closingCash: Number(shift.closing_cash ?? 0),
        expectedCash: Number(shift.expected_cash ?? 0),
        cashDifference: Number(shift.cash_difference ?? 0),
        differenceStatus: shift.difference_status,
        differenceNote: shift.difference_note ?? "",
        stok: [],
      });
      continue;
    }

    const idList = sisa.map((s) => s.product_id);

    const [produkRes, fisikSisa, terjualRes, wasteRes, afterClose] =
      await Promise.all([
        db.from("products").select("id, name").in("id", idList),
        Promise.resolve(sisa),
        db
          .from("transaction_items")
          .select("product_id, qty, transactions!inner(shift_id)")
          .eq("transactions.shift_id", shift.id)
          .eq("transactions.status", "completed"),
        db.from("waste").select("product_id, quantity").eq("shift_id", shift.id),
shift.closed_at
          ? db
              .from("stock_movements")
              .select("product_id, delta")
              .eq("kedai_id", shift.kedai_id)
              .gt("created_at", shift.closed_at)
          : Promise.resolve({ data: null, error: null }),
    ]);

    const saldoKini = await db
      .from("kedai_stock")
      .select("product_id, quantity")
      .eq("kedai_id", shift.kedai_id)
      .in("product_id", idList);

    const petaNama = new Map((produkRes.data ?? []).map((p) => [p.id, p.name]));
    const petaFisik = new Map(
      (fisikSisa ?? []).map((s) => [s.product_id, s.quantity]),
    );
    const petaTerjual = new Map<string, number>();
    for (const i of terjualRes.data ?? []) {
      petaTerjual.set(i.product_id, (petaTerjual.get(i.product_id) ?? 0) + i.qty);
    }
    const petaWaste = new Map<string, number>();
    for (const w of wasteRes.data ?? []) {
      petaWaste.set(w.product_id, (petaWaste.get(w.product_id) ?? 0) + w.quantity);
    }
    // delta bertanda: + stok masuk, − stok keluar.
    const petaAfter = new Map<string, number>();
    for (const m of afterClose.data ?? []) {
      petaAfter.set(m.product_id, (petaAfter.get(m.product_id) ?? 0) + m.delta);
    }
    const petaKini = new Map(
      (saldoKini.data ?? []).map((s) => [s.product_id, s.quantity]),
    );

    const stok = idList.map((pid) => {
      const tercatat =
        (petaKini.get(pid) ?? 0) - (petaAfter.get(pid) ?? 0);
      const fisik = petaFisik.get(pid) ?? null;
      return {
        productId: pid,
        productName: petaNama.get(pid) ?? "(produk dihapus)",
        tercatat,
        fisik,
        terjual: petaTerjual.get(pid) ?? 0,
        waste: petaWaste.get(pid) ?? 0,
        selisih: fisik === null ? null : fisik - tercatat,
      };
    });

    sesi.push({
      shiftId: shift.id,
      kedaiNama,
      businessDate: shift.business_date,
      closedAt: shift.closed_at ?? undefined,
      openingCash: Number(shift.opening_cash),
      closingCash: Number(shift.closing_cash ?? 0),
      expectedCash: Number(shift.expected_cash ?? 0),
      cashDifference: Number(shift.cash_difference ?? 0),
      differenceStatus: shift.difference_status,
      differenceNote: shift.difference_note ?? "",
      stok,
    });
  }

  if (sesi.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Setoran</h1>
        <p className="text-text-secondary">
          Belum ada penutupan yang bisa diperiksa. Setelah kasir menutup toko
          dan semua transaksi di perangkat sudah terkirim, penutupan itu muncul
          di sini untuk dicek selisih kas &amp; stoknya.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Setoran</h1>
      <p className="text-sm text-text-secondary">
        Periksa &amp; bereskan selisih tiap penutupan. Hanya penutupan yang
        datanya sudah lengkap (semua transaksi perangkat sudah masuk) yang
        tampil — selisih dihitung ulang oleh server, bukan diambil dari
        perangkat kasir.
      </p>
      <CollectScreen sesi={sesi} />
    </div>
  );
}