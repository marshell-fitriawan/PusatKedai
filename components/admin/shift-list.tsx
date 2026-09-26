import { Search } from "lucide-react";
import type { ShiftItem } from "@/app/admin/(dashboard)/shift/page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatUang } from "@/lib/utils";

const jam = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Filter memakai form GET biasa (tanpa JavaScript): field-name jadi
 * searchParams, halaman server di-render ulang. Konsisten dengan cara
 * /admin/stok memilih kedai, hanya dengan dua kolom tanggal tambahan.
 */
export function ShiftList({
  daftarKedai,
  kedaiTerpilih,
  dari,
  sampai,
  shift,
}: {
  daftarKedai: { id: string; name: string }[];
  kedaiTerpilih: string;
  dari: string;
  sampai: string;
  shift: ShiftItem[];
}) {
  let selisihFinal = 0;
  for (const s of shift) {
    if (s.status === "closed" && s.reconciliation_status === "final") {
      selisihFinal += Number(s.cash_difference ?? 0);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Buka Tutup</h1>
          <p className="text-sm text-text-secondary">
            Riwayat buka/tutup toko dan selisih kas tiap cabang
          </p>
        </div>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="min-w-48">
          <Select
            name="kedai"
            label="Kedai"
            defaultValue={kedaiTerpilih}
            options={[
              { value: "", label: "Semua kedai" },
              ...daftarKedai.map((k) => ({ value: k.id, label: k.name })),
            ]}
          />
        </div>
        <div className="min-w-40">
          <Input label="Dari tanggal" name="dari" type="date" defaultValue={dari} />
        </div>
        <div className="min-w-40">
          <Input
            label="Sampai tanggal"
            name="sampai"
            type="date"
            defaultValue={sampai}
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 items-center gap-2 border-2 border-ink bg-primary px-5 font-display text-sm font-bold uppercase tracking-tight text-ink shadow-brutal press-brutal"
        >
          <Search className="size-4" aria-hidden />
          Saring
        </button>
      </form>

      {shift.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-text-secondary">
            Tidak ada riwayat untuk filter ini.
          </p>
        </Card>
      ) : (
        <>
          {/* Mobile: kartu bertumpuk (daripada tabel yang harus digeser) */}
          <div className="flex flex-col gap-3 lg:hidden">
            {shift.map((s) => {
              const selisih = s.cash_difference ? Number(s.cash_difference) : 0;
              const belumFinal = s.reconciliation_status === "pending_sync";

              return (
                <Card key={s.id} className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{s.kedai?.name ?? "—"}</p>
                      <p className="text-xs text-text-secondary">{s.business_date}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {s.status === "open" ? (
                        <Badge tone="success">Buka</Badge>
                      ) : (
                        <Badge tone="neutral">Tutup</Badge>
                      )}
                      {belumFinal ? (
                        <Badge tone="warning">
                          Angka sementara {s.pending_sync_count > 0 ? `(${s.pending_sync_count} antrian)` : ""}
                        </Badge>
                      ) : (
                        <Badge tone="success">Angka pasti</Badge>
                      )}
                    </div>
                  </div>

                  <dl className="grid grid-cols-3 gap-2 text-center">
                    <div className="border-2 border-ink bg-surface-alt p-2">
                      <dt className="text-xs text-text-secondary">Kas awal</dt>
                      <dd className="tabular-nums">{formatUang(Number(s.opening_cash))}</dd>
                    </div>
                    <div className="border-2 border-ink bg-surface-alt p-2">
                      <dt className="text-xs text-text-secondary">Kas akhir</dt>
                      <dd className="tabular-nums">
                        {s.closing_cash != null ? formatUang(Number(s.closing_cash)) : "—"}
                      </dd>
                    </div>
                    <div className="border-2 border-ink bg-surface-alt p-2">
                      <dt className="text-xs text-text-secondary">Selisih</dt>
                      <dd
                        className={`tabular-nums ${
                          s.status === "closed"
                            ? belumFinal
                              ? "text-warning-text"
                              : selisih === 0
                                ? ""
                                : "text-danger-text"
                            : ""
                        }`}
                      >
                        {s.status === "closed" ? formatUang(selisih) : "—"}
                      </dd>
                    </div>
                  </dl>

                  <p className="text-xs text-text-secondary">
                    Buka {jam.format(new Date(s.opened_at))} · {s.pembuka?.name ?? "—"}
                    {s.status === "closed" && s.closed_at
                      ? ` · Tutup ${jam.format(new Date(s.closed_at))} · ${s.penutup?.name ?? "—"}`
                      : ""}
                  </p>
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
                    <TH>Hari</TH>
                    <TH>Dibuka</TH>
                    <TH>Ditutup</TH>
                    <TH numeric>Kas awal</TH>
                    <TH numeric>Kas akhir</TH>
                    <TH numeric>Selisih</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {shift.map((s) => {
                    const selisih = s.cash_difference
                      ? Number(s.cash_difference)
                      : 0;
                    const belumFinal = s.reconciliation_status === "pending_sync";

                    return (
                      <TR key={s.id}>
                        <TD className="font-semibold">{s.kedai?.name ?? "—"}</TD>
                        <TD className="text-text-secondary">{s.business_date}</TD>
                        <TD className="text-text-secondary">
                          {jam.format(new Date(s.opened_at))} ·{" "}
                          {s.pembuka?.name ?? "—"}
                        </TD>
                        <TD className="text-text-secondary">
                          {s.status === "closed" && s.closed_at
                            ? `${jam.format(new Date(s.closed_at))} · ${s.penutup?.name ?? "—"}`
                            : "—"}
                        </TD>
                        <TD numeric>{formatUang(Number(s.opening_cash))}</TD>
                        <TD numeric>
                          {s.closing_cash != null
                            ? formatUang(Number(s.closing_cash))
                            : "—"}
                        </TD>
                        <TD numeric>
                          {s.status === "closed" ? (
                            <span
                              className={
                                belumFinal
                                  ? "text-warning-text"
                                  : selisih === 0
                                    ? ""
                                    : "text-danger-text"
                              }
                            >
                              {formatUang(selisih)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TD>
                        <TD>
                          <div className="flex flex-wrap gap-1">
                            {s.status === "open" ? (
                              <Badge tone="success">Buka</Badge>
                            ) : (
                              <Badge tone="neutral">Tutup</Badge>
                            )}
                            {belumFinal ? (
                              <Badge tone="warning">
                                Angka sementara {s.pending_sync_count > 0 ? `(${s.pending_sync_count} antrian)` : ""}
                              </Badge>
                            ) : (
                              <Badge tone="success">Angka pasti</Badge>
                            )}
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          </Card>
        </>
      )}

      <p className="text-xs text-text-secondary">
        Penutupan berlabel “Angka sementara” dihitung dari sebagian data —
        beberapa transaksi di perangkat belum masuk — jadi selisihnya bisa
        berubah dan tidak ikut dijumlahkan. Total selisih penutupan yang sudah
        “Angka pasti” pada filter ini:{" "}
        <span className="font-semibold text-ink">
          {formatUang(selisihFinal)}
        </span>
      </p>
    </div>
  );
}