import { redirect } from "next/navigation";
import { Clock, DoorClosed, DoorOpen } from "lucide-react";
import { SisaFisikForm, type BarisStok } from "@/components/pos/sisa-fisik-form";
import { BukaTokoForm } from "@/components/pos/buka-toko-form";
import { TutupTokoForm } from "@/components/pos/tutup-toko-form";
import { WasteForm, type OpsiStok } from "@/components/pos/waste-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLastShift } from "@/lib/pos/shift";
import { getPosSession } from "@/lib/pos/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatUang } from "@/lib/utils";

export const metadata = { title: "Shift" };

export default async function ShiftPage() {
  const session = await getPosSession();
  if (!session) redirect("/pos/masuk");

  const db = createAdminClient();

  const [shift, produkRes, stokRes] = await Promise.all([
    getLastShift(session.kedaiId),
    db.from("products").select("id, name").eq("is_active", true).order("name"),
    db
      .from("kedai_stock")
      .select("product_id, quantity")
      .eq("kedai_id", session.kedaiId),
  ]);

  if (!shift) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Buka Toko</h1>

        <Card>
          <CardHeader>
            <CardTitle>Toko belum dibuka</CardTitle>
            <CardDescription>
              Transaksi baru bisa dicatat setelah shift dimulai — setiap
              penjualan harus melekat pada satu shift supaya kas bisa
              direkonsiliasi saat tutup.
            </CardDescription>
          </CardHeader>

          <BukaTokoForm />
        </Card>
      </div>
    );
  }

  // Stok kedai ini (untuk form waste saat open & hitung fisik saat closed).
  const petaStok = new Map(
    (stokRes.data ?? []).map((s) => [s.product_id, s.quantity]),
  );
  const stok: (BarisStok & OpsiStok)[] = (produkRes.data ?? [])
    .filter((p) => (petaStok.get(p.id) ?? 0) > 0)
    .map((p) => ({
      productId: p.id,
      name: p.name,
      quantity: petaStok.get(p.id) ?? 0,
    }));

  const jam = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (shift.status === "open") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Shift Berjalan</h1>

        <Card>
          <div className="flex items-center gap-2">
            <Badge tone="success">
              <DoorOpen className="size-3" aria-hidden />
              Terbuka
            </Badge>
            <span className="flex items-center gap-1 text-sm text-text-secondary">
              <Clock className="size-4" aria-hidden />
              Dibuka {jam.format(new Date(shift.opened_at))}
            </span>
          </div>

          <div className="mt-4 flex items-baseline justify-between gap-4">
            <dt className="text-sm text-text-secondary">Kas awal</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {formatUang(Number(shift.opening_cash))}
            </dd>
          </div>

          <p className="mt-4 text-xs text-text-secondary">
            Saat tutup, isi kas fisik yang <strong>benar-benar</strong> Anda
            hitung di laci — bukan menebak dari angka sistem. Perbandingan
            dengan catatan dilakukan pemilik.
          </p>

          <div className="mt-4">
            <TutupTokoForm kedaiId={session.kedaiId} />
          </div>
        </Card>

        <WasteForm stok={stok} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Shift Ditutup</h1>

      <Card>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">
            <DoorClosed className="size-3" aria-hidden />
            Tertutup
          </Badge>
          <span className="flex items-center gap-1 text-sm text-text-secondary">
            <Clock className="size-4" aria-hidden />
            Tutup {jam.format(new Date(shift.closed_at ?? shift.opened_at))}
          </span>
        </div>

        <div className="mt-4 flex items-baseline justify-between gap-4">
          <dt className="text-sm text-text-secondary">Kas awal</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {formatUang(Number(shift.opening_cash))}
          </dd>
        </div>

        {stok.length > 0 ? (
          <div className="mt-4">
            <SisaFisikForm shiftId={shift.id} stok={stok} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-secondary">
            Tidak ada stok tercatat di kedai ini — tidak ada sisa fisik yang
            perlu dihitung.
          </p>
        )}

        <p className="mt-4">
          <BukaTokoForm />
        </p>
      </Card>
    </div>
  );
}