import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { GroupedBars, warnaSeri } from "@/components/admin/trend-chart";
import { createClient } from "@/lib/supabase/server";
import { cn, formatUang } from "@/lib/utils";

export const metadata = { title: "Perbandingan Kedai — Admin Pusat" };

const fmtPendek = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit" });
const fmtPanjang = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const fmtPersen = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 1,
});

function isoTanggal(offsetHari = 0) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(Date.now() - offsetHari * 86400000));
}

function labelBucket(iso: string) {
  return fmtPendek.format(new Date(`${iso}T00:00:00Z`)).replace(".", "/");
}

type BarisKedai = {
  id: string;
  name: string;
  omzet: number;
  transaksi: number;
  hariAktif: number;
  pertumbuhan: number | null;
};

export default async function PerbandinganPage({
  searchParams,
}: {
  searchParams: Promise<{ dari?: string; sampai?: string }>;
}) {
  const supabase = await createClient();
  const sp = await searchParams;

  const tglDari = sp.dari ?? isoTanggal(13);
  const tglSampai = sp.sampai ?? isoTanggal(0);

  const [kedaiRes, omzetRes] = await Promise.all([
    supabase
      .from("kedai")
      .select("id, name")
      .eq("is_active", true)
      .eq("is_warehouse", false)
      .order("name"),
    supabase.rpc("report_omzet", {
      p_dari: tglDari,
      p_sampai: tglSampai,
      p_granularity: "harian",
    }),
  ]);

  const err = kedaiRes.error ?? omzetRes.error;
  if (err) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Perbandingan Kedai</h1>
        <p role="alert" className="border-2 border-ink bg-danger p-4 text-sm font-semibold text-ink">
          Gagal memuat perbandingan: {err.message}
        </p>
      </div>
    );
  }

  const daftarKedai = kedaiRes.data ?? [];
  const rows = omzetRes.data ?? [];

  const perKedai = new Map<string, Map<string, number>>();

  for (const r of rows) {
    const hari = perKedai.get(r.kedai_id) ?? new Map<string, number>();
    hari.set(r.tanggal, (hari.get(r.tanggal) ?? 0) + Number(r.omzet));
    perKedai.set(r.kedai_id, hari);
  }

  const baris: BarisKedai[] = daftarKedai.map((kedai) => {
    const hari = perKedai.get(kedai.id) ?? new Map<string, number>();
    const nilai = [...hari.entries()].sort(([a], [b]) => a.localeCompare(b));
    const omzet = nilai.reduce((a, [, v]) => a + v, 0);
    const transaksi = rows
      .filter((r) => r.kedai_id === kedai.id)
      .reduce((a, r) => a + Number(r.jumlah_transaksi), 0);
    const aktif = nilai.filter(([, v]) => v > 0).length;

    let pertumbuhan: number | null = null;
    if (nilai.length >= 4) {
      const paruh = Math.floor(nilai.length / 2);
      const awal = nilai.slice(0, paruh).reduce((a, [, v]) => a + v, 0);
      const akhir = nilai.slice(paruh).reduce((a, [, v]) => a + v, 0);
      if (awal > 0) pertumbuhan = ((akhir - awal) / awal) * 100;
    }

    return {
      id: kedai.id,
      name: kedai.name,
      omzet,
      transaksi,
      hariAktif: aktif,
      pertumbuhan,
    };
  });

  const totalOmzet = baris.reduce((a, b) => a + b.omzet, 0);
  const totalTransaksi = baris.reduce((a, b) => a + b.transaksi, 0);
  const terbaik = [...baris].sort((a, b) => b.omzet - a.omzet)[0];

  // Grafik: 7 bucket terakhir, satu seri per kedai.
  const semuaHari = [...new Set(rows.map((r) => r.tanggal))].sort();
  const hariGrafik = semuaHari.slice(-7);
  const labels = hariGrafik.map(labelBucket);
  const series = baris.map((b, i) => ({
    name: b.name,
    color: warnaSeri[i],
    points: hariGrafik.map((tgl) => ({
      label: labelBucket(tgl),
      value: perKedai.get(b.id)?.get(tgl) ?? 0,
      hint: `${b.name} · ${labelBucket(tgl)}: ${formatUang(
        perKedai.get(b.id)?.get(tgl) ?? 0,
      )}`,
    })),
  }));

  const bestOmzet = Math.max(1, ...baris.map((b) => b.omzet));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Perbandingan Kedai</h1>
          <p className="text-sm text-text-secondary">
            {fmtPanjang.format(new Date(`${tglDari}T00:00:00Z`))} —{" "}
            {fmtPanjang.format(new Date(`${tglSampai}T00:00:00Z`))} · per hari
          </p>
        </div>
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
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardTitle className="text-sm text-text-secondary">Total omzet</CardTitle>
          <p className="mt-1 text-xl font-bold tabular-nums">{formatUang(totalOmzet)}</p>
          <CardDescription>{totalTransaksi} transaksi selesai</CardDescription>
        </Card>
        <Card>
          <CardTitle className="text-sm text-text-secondary">Kedai terbaik</CardTitle>
          <p className="mt-1 truncate text-xl font-bold">{terbaik?.name ?? "—"}</p>
          <CardDescription>
            {terbaik ? `${formatUang(terbaik.omzet)} · ${terbaik.transaksi} transaksi` : ""}
          </CardDescription>
        </Card>
        <Card>
          <CardTitle className="text-sm text-text-secondary">Jarak</CardTitle>
          <p className="mt-1 text-xl font-bold tabular-nums">
            {baris.length > 1
              ? formatUang(Math.max(...baris.map((b) => b.omzet)) - Math.min(...baris.map((b) => b.omzet)))
              : "—"}
          </p>
          <CardDescription>Terbesar dikurangi terkecil</CardDescription>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-bold">Omzet harian {baris.length > 1 ? "tiap kedai" : ""}</h2>
        {labels.length > 0 ? (
          <>
            <GroupedBars labels={labels} series={series} />
            <div className="mt-3 flex flex-wrap gap-3">
              {baris.map((b, i) => (
                <span key={b.id} className="flex items-center gap-1 text-xs font-semibold text-text-secondary">
                  <span className={cn("size-2.5 border-2 border-ink", warnaSeri[i])} aria-hidden />
                  {b.name}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="border-2 border-dashed border-ink p-8 text-center text-sm text-text-secondary">
            Belum ada transaksi pada rentang ini.
          </p>
        )}
      </Card>

      {/* Mobile: kartu per kedai */}
      <div className="flex flex-col gap-3 lg:hidden">
        {baris.map((b, i) => {
          const porsi = totalOmzet > 0 ? (b.omzet / totalOmzet) * 100 : 0;
          return (
            <Card key={b.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="flex min-w-0 items-center gap-2 font-semibold">
                  <span className={cn("size-2.5 shrink-0 border-2 border-ink", warnaSeri[i])} aria-hidden />
                  <span className="truncate">{b.name}</span>
                </p>
                {b.pertumbuhan === null ? (
                  <Badge tone="neutral">—</Badge>
                ) : b.pertumbuhan >= 0 ? (
                  <Badge tone="success">
                    <ArrowUpRight className="size-3" aria-hidden />
                    +{fmtPersen.format(b.pertumbuhan)}%
                  </Badge>
                ) : (
                  <Badge tone="danger">
                    <ArrowDownRight className="size-3" aria-hidden />
                    {fmtPersen.format(b.pertumbuhan)}%
                  </Badge>
                )}
              </div>

              <div>
                <p className="text-xl font-bold tabular-nums">{formatUang(b.omzet)}</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-3 w-20 border-2 border-ink bg-surface-alt">
                    <div
                      className={cn("h-full", warnaSeri[i])}
                      style={{ width: `${(b.omzet / bestOmzet) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm tabular-nums text-text-secondary">
                    {porsi.toFixed(0)}% pangsa
                  </span>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-2 border-2 border-ink bg-surface-alt p-2 text-xs">
                <div>
                  <dt className="text-text-secondary">Transaksi</dt>
                  <dd className="tabular-nums">{b.transaksi}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Hari aktif</dt>
                  <dd className="tabular-nums">{b.hariAktif}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-text-secondary">Rata-rata / transaksi</dt>
                  <dd className="tabular-nums">
                    {formatUang(b.transaksi > 0 ? b.omzet / b.transaksi : 0)}
                  </dd>
                </div>
              </dl>
            </Card>
          );
        })}
      </div>

      {/* Desktop: tabel */}
      <Card className="hidden p-0 lg:block">
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Kedai</TH>
                <TH numeric>Omzet</TH>
                <TH numeric>Transaksi</TH>
                <TH numeric>Hari aktif</TH>
                <TH numeric>Rata-rata / transaksi</TH>
                <TH>Pertumbuhan</TH>
                <TH>Pangsa</TH>
              </TR>
            </THead>
            <TBody>
              {baris.map((b, i) => {
                const porsi = totalOmzet > 0 ? (b.omzet / totalOmzet) * 100 : 0;
                return (
                  <TR key={b.id}>
                    <TD>
                      <span className="flex items-center gap-2 font-semibold">
                        <span className={cn("size-2.5 border-2 border-ink", warnaSeri[i])} aria-hidden />
                        {b.name}
                      </span>
                    </TD>
                    <TD numeric>{formatUang(b.omzet)}</TD>
                    <TD numeric className="tabular-nums">{b.transaksi}</TD>
                    <TD numeric className="tabular-nums">{b.hariAktif}</TD>
                    <TD numeric>{formatUang(b.transaksi > 0 ? b.omzet / (b.transaksi) : 0)}</TD>
                    <TD>
                      {b.pertumbuhan === null ? (
                        <Badge tone="neutral">—</Badge>
                      ) : b.pertumbuhan >= 0 ? (
                        <Badge tone="success">
                          <ArrowUpRight className="size-3" aria-hidden />
                          +{fmtPersen.format(b.pertumbuhan)}%
                        </Badge>
                      ) : (
                        <Badge tone="danger">
                          <ArrowDownRight className="size-3" aria-hidden />
                          {fmtPersen.format(b.pertumbuhan)}%
                        </Badge>
                      )}
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-20 border-2 border-ink bg-surface-alt">
                          <div
                            className={cn("h-full", warnaSeri[i])}
                            style={{ width: `${(b.omzet / bestOmzet) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm tabular-nums text-text-secondary">
                          {porsi.toFixed(0)}%
                        </span>
                      </div>
                    </TD>
                  </TR>
                );
              })}
              <TR className="font-bold">
                <TD>Total</TD>
                <TD numeric>{formatUang(totalOmzet)}</TD>
                <TD numeric className="tabular-nums">{totalTransaksi}</TD>
                <TD numeric>—</TD>
                <TD numeric>—</TD>
                <TD>
                  <Badge tone="neutral">
                    <Minus className="size-3" aria-hidden />
                    —
                  </Badge>
                </TD>
                <TD>
                  <span className="text-sm tabular-nums">100%</span>
                </TD>
              </TR>
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}