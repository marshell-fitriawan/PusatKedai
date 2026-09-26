import { Boxes, PackageX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ExportCsvButton } from "@/components/admin/export-csv-button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Laporan Stok — Admin Pusat" };

type KedaiStok = { id: string; name: string; low_stock_threshold: number };

type BarisStok = {
  produkId: string;
  nama: string;
  perKedai: number[];
  total: number;
  status: "habis" | "menipis" | "aman";
};

export default async function LaporanStokPage() {
  const supabase = await createClient();

  const [kedaiRes, produkRes, stokRes] = await Promise.all([
    supabase
      .from("kedai")
      .select("id, name, low_stock_threshold")
      .eq("is_active", true)
      .order("name"),
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
    supabase.from("kedai_stock").select("kedai_id, product_id, quantity"),
  ]);

  const err = kedaiRes.error ?? produkRes.error ?? stokRes.error;
  if (err) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Laporan Stok</h1>
        <p role="alert" className="border-2 border-ink bg-danger p-4 text-sm font-semibold text-ink">
          Gagal memuat laporan stok: {err.message}
        </p>
      </div>
    );
  }

  const daftarKedai: KedaiStok[] = kedaiRes.data ?? [];
  const produk = produkRes.data ?? [];
  const stokRows = stokRes.data ?? [];

  const peta = new Map<string, Map<string, number>>();
  for (const s of stokRows) {
    const per = peta.get(s.product_id) ?? new Map<string, number>();
    per.set(s.kedai_id, Number(s.quantity) ?? 0);
    peta.set(s.product_id, per);
  }

  const baris: BarisStok[] = produk.map((p) => {
    const per = peta.get(p.id) ?? new Map<string, number>();
    const perKedai = daftarKedai.map((k) => per.get(k.id) ?? 0);

    let adaHabis = false;
    let adaMenipis = false;
    for (let i = 0; i < perKedai.length; i++) {
      const qty = perKedai[i];
      if (qty === 0) {
        adaHabis = true;
        break;
      }
      if (qty <= daftarKedai[i].low_stock_threshold) {
        adaMenipis = true;
      }
    }
    let status: BarisStok["status"] = "aman";
    if (adaHabis) status = "habis";
    else if (adaMenipis) status = "menipis";

    return {
      produkId: p.id,
      nama: p.name,
      perKedai,
      total: perKedai.reduce((a, b) => a + b, 0),
      status,
    };
  });

  baris.sort((a, b) => {
    const bobot = { habis: 0, menipis: 1, aman: 2 } as const;
    return bobot[a.status] - bobot[b.status] || a.nama.localeCompare(b.nama, "id");
  });

  const jumlahHabis = baris.filter((b) => b.status === "habis").length;
  const jumlahMenipis = baris.filter((b) => b.status === "menipis").length;

  const csv = baris.map((b) => [
    b.nama,
    ...b.perKedai,
    b.total,
    b.status === "habis" ? "Habis" : b.status === "menipis" ? "Menipis" : "Aman",
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Laporan Stok Konsolidasi</h1>
          <p className="text-sm text-text-secondary">
            Semua produk · posisi tiap kedai × {daftarKedai.length} kedai aktif
          </p>
        </div>
        <ExportCsvButton
          filename={`stok-konsolidasi_${new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kuala_Lumpur",
          }).format(new Date())}.csv`}
          header={[
            "Produk",
            ...daftarKedai.map((k) => k.name),
            "Total",
            "Status",
          ]}
          baris={csv}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardTitle className="flex items-center gap-2 text-sm text-text-secondary">
            <Boxes className="size-4 text-info-text" aria-hidden />
            SKU aktif
          </CardTitle>
          <p className="mt-1 text-xl font-bold tabular-nums">{baris.length}</p>
          <CardDescription>Produk beserta posisi stoknya</CardDescription>
        </Card>
        <Card>
          <CardTitle className="flex items-center gap-2 text-sm text-text-secondary">
            <PackageX className="size-4 text-danger-text" aria-hidden />
            Menipis / habis
          </CardTitle>
          <p className="mt-1 text-xl font-bold tabular-nums">
            <span className="text-danger-text">{jumlahHabis}</span>
            <span className="text-text-secondary"> / </span>
            {jumlahMenipis}
          </p>
          <CardDescription>Habis di ≥1 kedai · menipis di ≥1 kedai</CardDescription>
        </Card>
        <Card>
          <CardTitle className="text-sm text-text-secondary">Total unit</CardTitle>
          <p className="mt-1 text-xl font-bold tabular-nums">
            {baris.reduce((a, b) => a + b.total, 0)}
          </p>
          <CardDescription>Jumlah semua stok di semua kedai</CardDescription>
        </Card>
      </div>

      {baris.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-text-secondary">
            Belum ada produk terdaftar. Tambahkan produk dulu di menu Produk.
          </p>
        </Card>
      ) : (
        <>
          {/* Mobile: kartu per produk (kolom per kedai ditumpuk) */}
          <div className="flex flex-col gap-3 lg:hidden">
            {baris.map((b) => (
              <Card key={b.produkId} className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate font-semibold">{b.nama}</p>
                  <span className="shrink-0">
                    {b.status === "habis" ? (
                      <Badge tone="danger">Ada habis</Badge>
                    ) : b.status === "menipis" ? (
                      <Badge tone="warning">Menipis</Badge>
                    ) : (
                      <Badge tone="success">Aman</Badge>
                    )}
                  </span>
                </div>

                <dl className="divide-y divide-ink border-2 border-ink bg-surface-alt px-2 text-sm">
                  {daftarKedai.map((k, i) => {
                    const qty = b.perKedai[i];
                    const ambang = k.low_stock_threshold;
                    return (
                      <div
                        key={k.id}
                        className="flex items-center justify-between gap-2 py-1.5"
                      >
                        <dt className="min-w-0 truncate text-text-secondary">
                          {k.name}
                        </dt>
                        <dd
                          className={cn(
                            "shrink-0 tabular-nums",
                            qty === 0
                              ? "font-semibold text-danger-text"
                              : qty <= ambang
                                ? "font-semibold text-warning-text"
                                : "text-ink",
                          )}
                        >
                          {qty}
                        </dd>
                      </div>
                    );
                  })}
                </dl>

                <div className="flex items-center justify-between gap-2 border-t-2 border-ink pt-2">
                  <span className="text-xs text-text-secondary">Total</span>
                  <span className="font-bold tabular-nums">{b.total}</span>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop: tabel */}
          <Card className="hidden p-0 lg:block">
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Produk</TH>
                    {daftarKedai.map((k) => (
                      <TH key={k.id} numeric>
                        {k.name}
                      </TH>
                    ))}
                    <TH numeric>Total</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {baris.map((b) => (
                    <TR key={b.produkId}>
                      <TD className="font-semibold">{b.nama}</TD>
                      {b.perKedai.map((qty, i) => {
                        const ambang = daftarKedai[i].low_stock_threshold;
                        return (
                          <TD
                            key={daftarKedai[i].id}
                            numeric
                            className={cn(
                              "tabular-nums",
                              qty === 0
                                ? "font-semibold text-danger-text"
                                : qty <= ambang
                                  ? "font-semibold text-warning-text"
                                  : "text-ink",
                            )}
                            title={
                              qty <= ambang
                                ? `Ambang menipis kedai ${daftarKedai[i].name}: ${ambang}`
                                : undefined
                            }
                          >
                            {qty}
                          </TD>
                        );
                      })}
                      <TD numeric className="font-bold tabular-nums">
                        {b.total}
                      </TD>
                      <TD>
                        {b.status === "habis" ? (
                          <Badge tone="danger">Ada habis</Badge>
                        ) : b.status === "menipis" ? (
                          <Badge tone="warning">Menipis</Badge>
                        ) : (
                          <Badge tone="success">Aman</Badge>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </Card>
        </>
      )}

      <p className="text-xs text-text-secondary">
        Sel kuning = di bawah atau sama dengan ambang stok menipis kedai-nya,
        merah = habis (0). Produk tanpa baris stok dihitung 0. Angka diambil
        langsung dari stok; mutasi yang belum disetujui (masih menunggu) belum
        tercermin.
      </p>
    </div>
  );
}