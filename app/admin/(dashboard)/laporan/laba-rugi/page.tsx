import { TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ExportCsvButton } from "@/components/admin/export-csv-button";
import { createClient } from "@/lib/supabase/server";
import { cn, formatUang } from "@/lib/utils";

export const metadata = { title: "Untung-Rugi — Admin Pusat" };

const fmtPanjang = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function isoTanggal(offsetHari = 0) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(Date.now() - offsetHari * 86400000));
}

type BarisLaba = {
  id: string;
  name: string;
  omzet: number;
  pengeluaran: number;
  selisih: number;
};

export default async function LabaRugiPage({
  searchParams,
}: {
  searchParams: Promise<{ dari?: string; sampai?: string }>;
}) {
  const supabase = await createClient();
  const sp = await searchParams;

  const tglDari = sp.dari ?? isoTanggal(30);
  const tglSampai = sp.sampai ?? isoTanggal(0);

  const [kedaiRes, labaRes] = await Promise.all([
    supabase
      .from("kedai")
      .select("id, name, is_warehouse")
      .eq("is_active", true)
      .order("name"),
    supabase.rpc("report_laba_rugi", { p_dari: tglDari, p_sampai: tglSampai }),
  ]);

  const err = kedaiRes.error ?? labaRes.error;
  if (err) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Untung-Rugi</h1>
        <p role="alert" className="border-2 border-ink bg-danger p-4 text-sm font-semibold text-ink">
          Gagal memuat laporan: {err.message}
        </p>
      </div>
    );
  }

  const daftarKedai = kedaiRes.data ?? [];
  const dataLaba = labaRes.data ?? [];

  const peta = new Map(dataLaba.map((l) => [l.kedai_id, l]));

  const baris: BarisLaba[] = daftarKedai
    // Gudang pusat bukan gerai penjualan: report_laba_rugi sudah mengecualikannya,
    // kecuali ia punya pengeluaran pada rentang -- di situ barisnya tetap tampil.
    .filter((k) => !k.is_warehouse || peta.has(k.id))
    .map((k) => {
      const l = peta.get(k.id);
      return {
        id: k.id,
        name: k.name,
        omzet: Number(l?.omzet ?? 0),
        pengeluaran: Number(l?.pengeluaran ?? 0),
        selisih: Number(l?.selisih ?? 0),
      };
    });

  baris.sort((a, b) => b.omzet - a.omzet);

  const totalOmzet = baris.reduce((a, b) => a + b.omzet, 0);
  const totalPengeluaran = baris.reduce((a, b) => a + b.pengeluaran, 0);
  const totalSelisih = baris.reduce((a, b) => a + b.selisih, 0);

  const csvRows = baris.map((b) => [b.name, b.omzet, b.pengeluaran, b.selisih]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Untung-Rugi Kasar</h1>
          <p className="text-sm text-text-secondary">
            {fmtPanjang.format(new Date(`${tglDari}T00:00:00Z`))} —{" "}
            {fmtPanjang.format(new Date(`${tglSampai}T00:00:00Z`))}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="min-w-40">
              <Input label="Dari" name="dari" type="date" defaultValue={tglDari} />
            </div>
            <div className="min-w-40">
              <Input label="Sampai" name="sampai" type="date" defaultValue={tglSampai} />
            </div>
            <button
              type="submit"
              className="inline-flex h-11 items-center gap-2 border-2 border-ink bg-primary px-5 font-display text-sm font-bold uppercase tracking-tight text-ink shadow-brutal press-brutal"
            >
              Tampilkan
            </button>
          </form>
          <ExportCsvButton
            filename={`laba-rugi_${tglDari}_${tglSampai}.csv`}
            header={["Kedai", "Omzet", "Pengeluaran", "Selisih"]}
            baris={csvRows}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card>
          <CardTitle className="text-sm text-text-secondary">Omzet</CardTitle>
          <p className="mt-1 text-xl font-bold tabular-nums">{formatUang(totalOmzet)}</p>
          <CardDescription>Transaksi selesai</CardDescription>
        </Card>
        <Card>
          <CardTitle className="text-sm text-text-secondary">Pengeluaran</CardTitle>
          <p className="mt-1 text-xl font-bold tabular-nums">{formatUang(totalPengeluaran)}</p>
          <CardDescription>Biaya tercatat dalam rentang</CardDescription>
        </Card>
        <Card className="col-span-2">
          <CardTitle className="text-sm text-text-secondary">Selisih kasar</CardTitle>
          <p
            className={cn(
              "mt-1 text-xl font-bold tabular-nums",
              totalSelisih < 0 ? "text-danger-text" : "text-success-text",
            )}
          >
            {formatUang(totalSelisih)}
          </p>
          <CardDescription>
            {totalSelisih < 0
              ? "Total pengeluaran melebihi omzet"
              : "Total omzet melampaui pengeluaran"}
          </CardDescription>
        </Card>
      </div>

      {/* Mobile: kartu per kedai */}
      <div className="flex flex-col gap-3 lg:hidden">
        {baris.length === 0 ? (
          <Card className="text-center">
            <p className="text-sm text-text-secondary">Tidak ada kedai aktif.</p>
          </Card>
        ) : (
          baris.map((b) => (
            <Card key={b.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate font-semibold">{b.name}</p>
                {b.selisih < 0 ? (
                  <Badge tone="danger">Rugi</Badge>
                ) : b.selisih === 0 ? (
                  <Badge tone="neutral">Impas</Badge>
                ) : (
                  <Badge tone="success">Untung</Badge>
                )}
              </div>
              <dl className="divide-y divide-ink border-2 border-ink bg-surface-alt px-2 text-sm">
                <div className="flex items-center justify-between gap-2 py-1.5">
                  <dt className="text-text-secondary">Omzet</dt>
                  <dd className="tabular-nums">{formatUang(b.omzet)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2 py-1.5">
                  <dt className="text-text-secondary">Pengeluaran</dt>
                  <dd className="tabular-nums">{formatUang(b.pengeluaran)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2 py-1.5">
                  <dt className="font-semibold">Selisih</dt>
                  <dd className="font-bold tabular-nums">{formatUang(b.selisih)}</dd>
                </div>
              </dl>
            </Card>
          ))
        )}
      </div>

      {/* Desktop: tabel */}
      <Card className="hidden p-0 lg:block">
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Kedai</TH>
                <TH numeric>Omzet</TH>
                <TH numeric>Pengeluaran</TH>
                <TH numeric>Selisih</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {baris.map((b) => (
                <TR key={b.id}>
                  <TD className="font-semibold">{b.name}</TD>
                  <TD numeric>{formatUang(b.omzet)}</TD>
                  <TD numeric>{formatUang(b.pengeluaran)}</TD>
                  <TD numeric>{formatUang(b.selisih)}</TD>
                  <TD>
                    {b.selisih < 0 ? (
                      <Badge tone="danger">Rugi</Badge>
                    ) : b.selisih === 0 ? (
                      <Badge tone="neutral">Impas</Badge>
                    ) : (
                      <Badge tone="success">Untung</Badge>
                    )}
                  </TD>
                </TR>
              ))}
              {baris.length === 0 ? (
                <TR>
                  <TD colSpan={5} className="text-center text-text-secondary">
                    Tidak ada kedai aktif.
                  </TD>
                </TR>
              ) : null}
            </TBody>
          </Table>
        </div>
      </Card>

      <p className="text-xs text-text-secondary">
        <TrendingUp className="mr-1 inline size-3" aria-hidden />
        Angka ini <strong>laba-rugi kasar</strong>: omzet transaksi selesai
        dikurangi pengeluaran tercatat. Belum memperhitungkan nilai persediaan,
        penyusutan aset, maupun pajak.
      </p>
    </div>
  );
}