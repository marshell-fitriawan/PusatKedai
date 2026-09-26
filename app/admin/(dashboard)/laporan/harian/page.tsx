import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatUang } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Ringkasan Harian — Admin Pusat" };

export const dynamic = "force-dynamic";

const tgl = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function isoTanggal(offsetHari = 0) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(Date.now() - offsetHari * 86400000));
}

type BarisHarian = {
  tanggal: string;
  kedai_id: string;
  kedai: string;
  omzet: number;
  jumlah_transaksi: number;
  jumlah_void: number;
  jumlah_perlu_review: number;
  selisih_terbuka: number;
};

type BarisRasio = {
  kedai_id: string;
  kedai: string;
  employee_id: string;
  employee: string;
  total_transaksi: number;
  jumlah_void: number;
  rasio_persen: number;
};

function toneRasio(r: number): "neutral" | "warning" | "danger" {
  if (r >= 50) return "danger";
  if (r >= 25) return "warning";
  return "neutral";
}

export default async function HarianPage({
  searchParams,
}: {
  searchParams: Promise<{ dari?: string; sampai?: string }>;
}) {
  await requireAdmin();
  const db = createAdminClient();

  const { dari, sampai } = await searchParams;
  const v1dari = /^\d{4}-\d{2}-\d{2}$/.test(dari ?? "") ? dari! : isoTanggal(13);
  const v1sampai = /^\d{4}-\d{2}-\d{2}$/.test(sampai ?? "") ? sampai! : isoTanggal(0);

  const [{ data: harian }, { data: rasio }] = await Promise.all([
    db.rpc("report_harian", { p_dari: v1dari, p_sampai: v1sampai }),
    db.rpc("report_void_karyawan", { p_dari: v1dari, p_sampai: v1sampai }),
  ]);

  const barisHarian = (harian ?? []) as BarisHarian[];
  const barisRasio = (rasio ?? []) as BarisRasio[];

  const totalOmzet = barisHarian.reduce((n, b) => n + Number(b.omzet), 0);
  const totalVoid = barisHarian.reduce((n, b) => n + b.jumlah_void, 0);
  const totalTertunda = barisHarian.reduce((n, b) => n + b.jumlah_perlu_review, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Ringkasan Harian</h1>
        <p className="text-sm text-text-secondary">
          Omzet, pembatalan, dan yang menunggu keputusan per tanggal × kedai.
          Jumlahnya sengaja dipisah — penjualan yang dibatalkan atau belum
          diputuskan tidak ikut dicampur ke omzet, supaya satu angka tidak
          menyembunyikan yang lain.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="min-w-40">
          <Input label="Dari" name="dari" type="date" defaultValue={v1dari} max={v1sampai} />
        </div>
        <div className="min-w-40">
          <Input label="Sampai" name="sampai" type="date" defaultValue={v1sampai} min={v1dari} />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 items-center gap-2 border-2 border-ink bg-primary px-5 font-display text-sm font-bold uppercase tracking-tight text-ink shadow-brutal press-brutal"
        >
          Tampilkan
        </button>
      </form>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-text-secondary">Omzet rentang</p>
          <p className="text-xl font-bold tabular-nums">{formatUang(totalOmzet)}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-secondary">Dibatalkan</p>
          <p className="text-xl font-bold tabular-nums">{totalVoid}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-secondary">Menunggu keputusan</p>
          <p className="text-xl font-bold tabular-nums">{totalTertunda}</p>
        </Card>
      </div>

      {/* Mobile: kartu per baris (semua angka terlihat) */}
      <div className="flex flex-col gap-3 lg:hidden">
        {barisHarian.length === 0 ? (
          <Card className="text-center">
            <p className="text-sm text-text-secondary">
              Tidak ada data pada rentang ini.
            </p>
          </Card>
        ) : (
          barisHarian.map((b) => (
            <Card key={`${b.tanggal}-${b.kedai_id}`} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{b.kedai}</p>
                  <p className="text-xs text-text-secondary">
                    {tgl.format(new Date(`${b.tanggal}T00:00:00`))}
                  </p>
                </div>
                <p className="shrink-0 text-base font-bold tabular-nums">
                  {formatUang(Number(b.omzet))}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-2 border-2 border-ink bg-surface-alt p-2 text-xs">
                <div>
                  <dt className="text-text-secondary">Transaksi</dt>
                  <dd className="tabular-nums">{b.jumlah_transaksi}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Dibatalkan</dt>
                  <dd>
                    {b.jumlah_void > 0 ? (
                      <Badge tone="danger">{b.jumlah_void}</Badge>
                    ) : (
                      <span className="text-text-disabled">0</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Menunggu keputusan</dt>
                  <dd>
                    {b.jumlah_perlu_review > 0 ? (
                      <Badge tone="warning">{b.jumlah_perlu_review}</Badge>
                    ) : (
                      <span className="text-text-disabled">0</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Kas belum beres</dt>
                  <dd>
                    {b.selisih_terbuka > 0 ? (
                      <Badge tone="warning">{b.selisih_terbuka}</Badge>
                    ) : (
                      <span className="text-text-disabled">0</span>
                    )}
                  </dd>
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
                <TH>Tanggal</TH>
                <TH>Kedai</TH>
                <TH numeric>Omzet</TH>
                <TH numeric>Transaksi</TH>
                <TH numeric>Dibatalkan</TH>
                <TH numeric>Menunggu keputusan</TH>
                <TH numeric>Kas belum beres</TH>
              </TR>
            </THead>
            <TBody>
              {barisHarian.length === 0 ? (
                <TR>
                  <TD colSpan={7} className="text-center text-text-secondary">
                    Tidak ada data pada rentang ini.
                  </TD>
                </TR>
              ) : (
                barisHarian.map((b) => (
                  <TR key={`${b.tanggal}-${b.kedai_id}`}>
                    <TD className="whitespace-nowrap text-text-secondary">
                      {tgl.format(new Date(`${b.tanggal}T00:00:00`))}
                    </TD>
                    <TD className="font-semibold">{b.kedai}</TD>
                    <TD numeric>{formatUang(Number(b.omzet))}</TD>
                    <TD numeric className="tabular-nums">{b.jumlah_transaksi}</TD>
                    <TD numeric>
                      {b.jumlah_void > 0 ? (
                        <Badge tone="danger">{b.jumlah_void}</Badge>
                      ) : (
                        <span className="text-text-disabled">0</span>
                      )}
                    </TD>
                    <TD numeric>
                      {b.jumlah_perlu_review > 0 ? (
                        <Badge tone="warning">{b.jumlah_perlu_review}</Badge>
                      ) : (
                        <span className="text-text-disabled">0</span>
                      )}
                    </TD>
                    <TD numeric>
                      {b.selisih_terbuka > 0 ? (
                        <Badge tone="warning">{b.selisih_terbuka}</Badge>
                      ) : (
                        <span className="text-text-disabled">0</span>
                      )}
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </Card>

      <h2 className="pt-2 text-lg font-semibold">Rasio pembatalan per karyawan</h2>
      <p className="text-sm text-text-secondary">
        Hanya karyawan yang punya pembatalan yang muncul. Rasio = jumlah
        pembatalan dibagi seluruh transaksinya (selesai + dibatalkan).
        Pembatalan yang belum diputuskan belum dihitung, karena belum tentu
        jadi batal.
      </p>
      {/* Mobile: kartu per karyawan */}
      <div className="flex flex-col gap-3 lg:hidden">
        {barisRasio.length === 0 ? (
          <Card className="text-center">
            <p className="text-sm text-text-secondary">
              Tidak ada pembatalan pada rentang ini. Aman.
            </p>
          </Card>
        ) : (
          barisRasio.map((r) => (
            <Card
              key={`${r.kedai_id}-${r.employee_id}`}
              className="flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.employee}</p>
                  <p className="truncate text-xs text-text-secondary">{r.kedai}</p>
                </div>
                <Badge
                  tone={toneRasio(Number(r.rasio_persen ?? 0))}
                  className="shrink-0 tabular-nums"
                >
                  {Number(r.rasio_persen ?? 0)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2 border-2 border-ink bg-surface-alt p-2 text-xs">
                <span className="text-text-secondary">Transaksi</span>
                <span className="tabular-nums">{r.total_transaksi}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-text-secondary">Dibatalkan</span>
                <Badge tone={r.jumlah_void > 0 ? "danger" : "neutral"}>
                  {r.jumlah_void}
                </Badge>
              </div>
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
                <TH>Karyawan</TH>
                <TH numeric>Transaksi</TH>
                <TH numeric>Dibatalkan</TH>
                <TH numeric>Rasio</TH>
              </TR>
            </THead>
            <TBody>
              {barisRasio.length === 0 ? (
                <TR>
                  <TD colSpan={5} className="text-center text-text-secondary">
                    Tidak ada pembatalan pada rentang ini. Aman.
                  </TD>
                </TR>
              ) : (
                barisRasio.map((r) => (
                  <TR key={`${r.kedai_id}-${r.employee_id}`}>
                    <TD className="font-semibold">{r.kedai}</TD>
                    <TD>{r.employee}</TD>
                    <TD numeric className="tabular-nums">{r.total_transaksi}</TD>
                    <TD numeric>
                      <Badge tone={r.jumlah_void > 0 ? "danger" : "neutral"}>
                        {r.jumlah_void}
                      </Badge>
                    </TD>
                    <TD numeric>
                      <Badge tone={toneRasio(Number(r.rasio_persen ?? 0))} className="tabular-nums">
                        {Number(r.rasio_persen ?? 0)}%
                      </Badge>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}