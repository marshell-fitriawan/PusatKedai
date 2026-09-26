"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, X } from "lucide-react";
import { setStatusSelisih } from "@/app/admin/(dashboard)/collect/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { formatUang } from "@/lib/utils";

export type BarisStokSesi = {
  productId: string;
  productName: string;
  tercatat: number;
  fisik: number | null;
  terjual: number;
  waste: number;
  selisih: number | null;
};

export type BarisSesi = {
  shiftId: string;
  kedaiNama: string;
  businessDate: string;
  closedAt?: string;
  openingCash: number;
  closingCash: number;
  expectedCash: number;
  cashDifference: number;
  differenceStatus: "terbuka" | "dijelaskan" | "rugi";
  differenceNote: string;
  stok: BarisStokSesi[];
};

type StatusSelisih = BarisSesi["differenceStatus"];

const opsiStatus: { value: StatusSelisih; label: string }[] = [
  { value: "terbuka", label: "Terbuka — belum ditindaklanjuti" },
  { value: "dijelaskan", label: "Sudah dijelaskan" },
  { value: "rugi", label: "Dihitung sebagai rugi" },
];

function KartuSesi({ sesi }: { sesi: BarisSesi }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusSelisih>(sesi.differenceStatus);
  const [note, setNote] = useState(sesi.differenceNote);

  const cashTone =
    sesi.cashDifference === 0
      ? "success"
      : sesi.cashDifference > 0
        ? "warning"
        : "danger";

  const adaSelisihStok =
    sesi.stok.some((s) => s.selisih !== null && s.selisih !== 0) ||
    sesi.stok.some((s) => s.selisih === null && s.tercatat !== 0);

  function simpan() {
    setError(null);
    startTransition(async () => {
      const res = await setStatusSelisih(sesi.shiftId, status, note);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold">{sesi.kedaiNama}</p>
          <p className="text-sm text-text-secondary">
            Tutup {sesi.businessDate}
            {sesi.closedAt
              ? ` · ${new Intl.DateTimeFormat("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(sesi.closedAt))}`
              : ""}
          </p>
        </div>
        <Badge tone={cashTone}>
          {sesi.cashDifference === 0 ? (
            <Check className="size-3" aria-hidden />
          ) : (
            <X className="size-3" aria-hidden />
          )}
          Selisih kas {sesi.cashDifference > 0 ? "+" : ""}
          {formatUang(sesi.cashDifference)}
        </Badge>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-text-secondary">Kas awal</dt>
          <dd className="tabular-nums">{formatUang(sesi.openingCash)}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-secondary">Setoran kasir</dt>
          <dd className="tabular-nums">{formatUang(sesi.closingCash)}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-secondary">Kas seharusnya</dt>
          <dd className="tabular-nums">{formatUang(sesi.expectedCash)}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-secondary">Selisih</dt>
          <dd className="font-semibold tabular-nums">
            {formatUang(sesi.cashDifference)}
          </dd>
        </div>
      </dl>

      {sesi.stok.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Selisih stok</p>
          {/* Mobile: kartu per produk */}
          <div className="flex flex-col gap-2 lg:hidden">
            {sesi.stok.map((s) => (
              <div
                key={s.productId}
                className="flex flex-col gap-1 border-2 border-ink bg-surface p-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate font-medium">{s.productName}</p>
                  <span
                    className={`shrink-0 font-semibold tabular-nums ${
                      s.selisih === null
                        ? "text-text-disabled"
                        : s.selisih === 0
                          ? "text-success-text"
                          : s.selisih > 0
                            ? "text-warning-text"
                            : "text-danger-text"
                    }`}
                  >
                    {s.selisih === null
                      ? "–"
                      : s.selisih > 0
                        ? `+${s.selisih}`
                        : s.selisih}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-text-secondary">Di sistem</dt>
                    <dd className="tabular-nums">{s.tercatat}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-text-secondary">Hitung kasir</dt>
                    <dd className="tabular-nums">{s.fisik ?? "–"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-text-secondary">Terjual</dt>
                    <dd className="tabular-nums">{s.terjual}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-text-secondary">Rusak/buang</dt>
                    <dd className="tabular-nums">{s.waste}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>

          {/* Desktop: tabel */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-ink bg-surface-alt text-left font-display text-xs font-bold uppercase tracking-tight">
                  <th className="pb-2">Produk</th>
                  <th className="pb-2 text-right">Di sistem</th>
                  <th className="pb-2 text-right">Hitung kasir</th>
                  <th className="pb-2 text-right">Terjual</th>
                  <th className="pb-2 text-right">Rusak/buang</th>
                  <th className="pb-2 text-right">Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink">
                {sesi.stok.map((s) => (
                  <tr key={s.productId}>
                    <td className="py-2 font-medium">{s.productName}</td>
                    <td className="py-2 text-right tabular-nums">{s.tercatat}</td>
                    <td className="py-2 text-right tabular-nums">
                      {s.fisik ?? "–"}
                    </td>
                    <td className="py-2 text-right tabular-nums">{s.terjual}</td>
                    <td className="py-2 text-right tabular-nums">{s.waste}</td>
                    <td
                      className={`py-2 text-right font-semibold tabular-nums ${
                        s.selisih === null
                          ? "text-text-disabled"
                          : s.selisih === 0
                            ? "text-success-text"
                            : s.selisih > 0
                              ? "text-warning-text"
                              : "text-danger-text"
                      }`}
                    >
                      {s.selisih === null ? "–" : s.selisih > 0 ? `+${s.selisih}` : s.selisih}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {adaSelisihStok ? (
            <p className="text-xs text-text-secondary">
              Selisih = hitung kasir − di sistem. Angka “di sistem” sudah
              dikurangi pergerakan setelah penutupan (produk rusak/buang serta
              mutasi berikutnya), jadi selisih ini murni perbedaan pada
              penutupan itu sendiri.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-2 border-ink bg-surface-alt p-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Select
            label="Status selisih"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusSelisih)}
            options={opsiStatus}
          />
        </div>
        <div className="sm:w-1/2">
          <label htmlFor={`catatan-${sesi.shiftId}`} className="text-sm font-semibold">
            Catatan keputusan
          </label>
          <textarea
            id={`catatan-${sesi.shiftId}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="cth. selisih karena salah kasih kembalian, sudah dibicarakan"
            className="mt-1 w-full border-2 border-ink bg-surface px-3 py-2 text-base disabled:bg-surface-alt disabled:text-text-disabled"
            rows={2}
          />
        </div>
        <Button
          disabled={pending || status === sesi.differenceStatus && note === sesi.differenceNote}
          onClick={simpan}
        >
          {pending ? "Menyimpan..." : "Simpan Status"}
        </Button>
      </div>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 border-2 border-ink bg-danger p-3 text-sm font-semibold text-ink"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </Card>
  );
}

export function CollectScreen({ sesi }: { sesi: BarisSesi[] }) {
  return (
    <div className="flex flex-col gap-4">
      {sesi.map((s) => (
        <KartuSesi key={s.shiftId} sesi={s} />
      ))}
    </div>
  );
}