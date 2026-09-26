import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  ReceiptText,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TrendChart } from "@/components/admin/trend-chart";
import { createClient } from "@/lib/supabase/server";
import { formatUang } from "@/lib/utils";

export const metadata = { title: "Dashboard — Admin Pusat" };

const granOptions = [
  { value: "harian", label: "Harian" },
  { value: "mingguan", label: "Mingguan" },
  { value: "bulanan", label: "Bulanan" },
] as const;
type Granularitas = (typeof granOptions)[number]["value"];

const fmtTanggal = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "2-digit",
});
const fmtTanggalPanjang = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function isoTanggal(offsetHari = 0) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(Date.now() - offsetHari * 86400000));
}

function labelBucket(iso: string, g: Granularitas) {
  const d = new Date(`${iso}T00:00:00Z`);
  return g === "harian" ? fmtTanggal.format(d).replace(".", "/") : fmtTanggalPanjang.format(d);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ dari?: string; sampai?: string; gran?: string }>;
}) {
  const supabase = await createClient();
  const sp = await searchParams;

  const g: Granularitas =
    sp.gran === "mingguan" ? "mingguan" : sp.gran === "bulanan" ? "bulanan" : "harian";
  const tglDari = sp.dari ?? isoTanggal(13);
  const tglSampai = sp.sampai ?? isoTanggal(0);

  const [kedaiRes, omzetRes, expenseRes] = await Promise.all([
    supabase
      .from("kedai")
      .select("id, name")
      .eq("is_active", true)
      .eq("is_warehouse", false)
      .order("name"),
    supabase.rpc("report_omzet", {
      p_dari: tglDari,
      p_sampai: tglSampai,
      p_granularity: g,
    }),
    supabase
      .from("expenses")
      .select("amount")
      .gte("expense_date", tglDari)
      .lte("expense_date", tglSampai),
  ]);

  const err = kedaiRes.error ?? omzetRes.error ?? expenseRes.error;
  if (err) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p role="alert" className="border-2 border-ink bg-danger p-4 text-sm font-semibold text-ink">
          Gagal memuat dashboard: {err.message}
        </p>
      </div>
    );
  }

  const daftarKedai = kedaiRes.data ?? [];
  const rows = omzetRes.data ?? [];
  const totalPengeluaran = (expenseRes.data ?? []).reduce(
    (acc, e) => acc + Number(e.amount),
    0,
  );

  const byKedai = new Map<string, { omzet: number; transaksi: number }>();
  const byTanggal = new Map<string, { omzet: number; transaksi: number }>();

  for (const r of rows) {
    const k = byKedai.get(r.kedai_id) ?? { omzet: 0, transaksi: 0 };
    k.omzet += Number(r.omzet);
    k.transaksi += Number(r.jumlah_transaksi);
    byKedai.set(r.kedai_id, k);

    const t = byTanggal.get(r.tanggal) ?? { omzet: 0, transaksi: 0 };
    t.omzet += Number(r.omzet);
    t.transaksi += Number(r.jumlah_transaksi);
    byTanggal.set(r.tanggal, t);
  }

  const totalOmzet = [...byKedai.values()].reduce((a, b) => a + b.omzet, 0);
  const totalTransaksi = [...byKedai.values()].reduce(
    (a, b) => a + b.transaksi,
    0,
  );
  const selisih = totalOmzet - totalPengeluaran;

  const tren = [...byTanggal.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tanggal, agg]) => ({
      label: labelBucket(tanggal, g),
      value: agg.omzet,
      hint: `${labelBucket(tanggal, g)}: ${formatUang(agg.omzet)} · ${agg.transaksi} transaksi`,
    }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-text-secondary">
            {fmtTanggalPanjang.format(new Date(`${tglSampai}T00:00:00Z`))} ·{" "}
            {g === "harian" ? "per hari" : g === "mingguan" ? "per minggu" : "per bulan"} ·{" "}
            {daftarKedai.length} kedai aktif
          </p>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-32">
            <Select
              name="gran"
              label="Tampilan"
              defaultValue={g}
              options={[...granOptions]}
            />
          </div>
          <div className="min-w-40">
            <Input label="Dari" name="dari" type="date" defaultValue={tglDari} />
          </div>
          <div className="min-w-40">
            <Input label="Sampai" name="sampai" type="date" defaultValue={tglSampai} />
          </div>
          <button
            type="submit"
            className="inline-flex h-11 items-center border-2 border-ink bg-primary px-5 font-display text-sm font-bold uppercase tracking-tight text-ink shadow-brutal press-brutal"
          >
            Tampilkan
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="border-2 border-ink bg-primary p-1 text-ink">
              <TrendingUp className="size-4" aria-hidden />
            </span>
            Omzet
          </CardTitle>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatUang(totalOmzet)}</p>
          <CardDescription>{totalTransaksi} transaksi selesai</CardDescription>
        </Card>
        <Card>
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="border-2 border-ink bg-info p-1 text-white">
              <ReceiptText className="size-4" aria-hidden />
            </span>
            Pengeluaran
          </CardTitle>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {formatUang(totalPengeluaran)}
          </p>
          <CardDescription>Biaya operasional tercatat</CardDescription>
        </Card>
        <Card>
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="border-2 border-ink bg-success p-1 text-ink">
              <BadgeCheck className="size-4" aria-hidden />
            </span>
            Selisih
          </CardTitle>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {formatUang(selisih)}
          </p>
          <div className="mt-1">
            <Badge tone={selisih < 0 ? "danger" : "success"}>
              {selisih < 0 ? "Minus" : "Plus"}
            </Badge>
          </div>
          <CardDescription>
            {selisih < 0 ? "Pengeluaran melebihi omzet" : "Omzet melampaui pengeluaran"}
          </CardDescription>
        </Card>
        <Card>
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="border-2 border-ink bg-warning p-1 text-ink">
              <BarChart3 className="size-4" aria-hidden />
            </span>
            Rata-rata /hari
          </CardTitle>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {formatUang(tren.length > 0 ? totalOmzet / tren.length : 0)}
          </p>
          <CardDescription>
            Selama {tren.length}{" "}
            {g === "harian" ? "hari" : g === "bulanan" ? "bulan" : "minggu"}
          </CardDescription>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-1">
            <h2 className="text-lg font-bold">Tren omzet</h2>
            <Link
              href="/admin/dashboard/perbandingan"
              className="flex items-center gap-1 border-2 border-ink bg-surface px-2 py-1 font-display text-xs font-bold uppercase tracking-tight shadow-brutal-sm press-brutal hover:bg-primary-light"
            >
              Perbandingan kedai
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <p className="mb-3 text-sm text-text-secondary">
            Total semua kedai, per {g === "harian" ? "hari" : g === "mingguan" ? "minggu" : "bulan"}
          </p>
          {tren.length > 0 ? (
            <TrendChart data={tren} />
          ) : (
            <p className="border-2 border-dashed border-ink p-8 text-center text-sm text-text-secondary">
              Belum ada transaksi pada rentang ini.
            </p>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between gap-1">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span className="border-2 border-ink bg-primary p-1 text-ink">
                <Wallet className="size-5" aria-hidden />
              </span>
              Pengeluaran
            </h2>
            <Link
              href="/admin/pengeluaran"
              className="flex items-center gap-1 border-2 border-ink bg-surface px-2 py-1 font-display text-xs font-bold uppercase tracking-tight shadow-brutal-sm press-brutal hover:bg-primary-light"
            >
              Kelola
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <p className="text-sm text-text-secondary">
            Biaya operasional yang tercatat ikut mengurangi selisih di atas.
            Rincian per kategori dan per kedai ada di halaman pengeluaran, dan
            dikalkulasi ulang di laporan{" "}
            <Link
              href="/admin/laporan"
              className="font-semibold underline underline-offset-4"
            >
              laba rugi
            </Link>
            .
          </p>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-bold">Omzet per Kedai</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {daftarKedai.map((kedai) => {
            const agg = byKedai.get(kedai.id) ?? { omzet: 0, transaksi: 0 };
            const porsi = totalOmzet > 0 ? (agg.omzet / totalOmzet) * 100 : 0;
            return (
              <Card key={kedai.id}>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="truncate">{kedai.name}</CardTitle>
                  <Badge tone={porsi >= 50 ? "success" : "neutral"}>
                    {porsi.toFixed(0)}%
                  </Badge>
                </div>
                <p className="mt-1 text-xl font-bold tabular-nums">
                  {formatUang(agg.omzet)}
                </p>
                <CardDescription>{agg.transaksi} transaksi</CardDescription>
                <div
                  className="mt-3 h-3 w-full border-2 border-ink bg-surface"
                  title={`${kedai.name}: ${porsi.toFixed(1)}% dari total omzet`}
                >
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.min(100, porsi)}%` }}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}