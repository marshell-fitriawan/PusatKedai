"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Ban, Receipt } from "lucide-react";
import { ajukanVoid } from "@/app/pos/(kasir)/riwayat/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { formatUang } from "@/lib/utils";

type Item = {
  product_name_snapshot: string;
  price_snapshot: number;
  qty: number;
  subtotal: number;
};

type Transaksi = {
  id: string;
  transaction_number: string | null;
  local_number: string;
  total: number;
  payment_method: "tunai" | "qris";
  status: "completed" | "perlu_review" | "void";
  created_at: string;
  transaction_items: Item[];
};

const jam = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
});

export function RiwayatList({
  data,
  tanggal,
  hariIni,
  adaShiftTerbuka,
}: {
  data: Transaksi[];
  tanggal: string;
  hariIni: string;
  adaShiftTerbuka: boolean;
}) {
  const router = useRouter();
  const [dipilih, setDipilih] = useState<Transaksi | null>(null);
  const [alasan, setAlasan] = useState("");
  const [konfirmasiVoid, setKonfirmasiVoid] = useState(false);
  const [terkirim, setTerkirim] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const aktif = data.filter((t) => t.status === "completed");
  const omzet = aktif.reduce((n, t) => n + Number(t.total), 0);
  const menunggu = data.filter((t) => t.status === "perlu_review").length;

  function kirim(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await ajukanVoid(id, alasan);
      if (res.error) {
        setError(res.error);
        return;
      }
      setKonfirmasiVoid(false);
      setTerkirim(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Riwayat</h1>
        <p className="text-sm text-text-secondary">
          {aktif.length} transaksi · {formatUang(omzet)}
          {menunggu > 0 ? ` · ${menunggu} menunggu review` : ""}
          {data.length > aktif.length + menunggu
            ? ` · ${data.length - aktif.length - menunggu} dibatalkan`
            : ""}
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">Tanggal</span>
        <input
          type="date"
          value={tanggal}
          max={hariIni}
          onChange={(e) => router.push(`/pos/riwayat?tgl=${e.target.value}`)}
          className="h-11 border-2 border-ink bg-surface px-3 text-base"
        />
      </label>

      {data.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-text-secondary">
            Belum ada transaksi pada tanggal ini.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setDipilih(t)}
                className="flex w-full items-center gap-3 border-2 border-ink bg-surface p-3 text-left shadow-brutal press-brutal hover:bg-primary-light"
              >
                <Receipt
                  className="size-5 shrink-0 text-text-secondary"
                  aria-hidden
                />

                <div className="min-w-0 flex-1">
                  <p className="font-semibold tabular-nums">
                    {/* Nomor final kalau sudah ada; kalau belum, label
                        sementara dari perangkat. Di M2 kondisi kedua akan
                        sering terjadi saat antrian offline belum terkirim. */}
                    {t.transaction_number ? `#${t.transaction_number}` : t.local_number}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {jam.format(new Date(t.created_at))} ·{" "}
                    {t.transaction_items.length} item · {t.payment_method}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className="font-bold tabular-nums">
                    {formatUang(Number(t.total))}
                  </span>
                  {t.status === "void" ? (
                    <Badge tone="danger">Dibatalkan</Badge>
                  ) : t.status === "perlu_review" ? (
                    <Badge tone="warning">Menunggu review</Badge>
                  ) : !t.transaction_number ? (
                    <Badge tone="warning">Belum sync</Badge>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={dipilih !== null}
        onClose={() => {
          setDipilih(null);
          setAlasan("");
          setKonfirmasiVoid(false);
          setTerkirim(false);
          setError(null);
        }}
        title={
          dipilih?.transaction_number
            ? `Transaksi #${dipilih.transaction_number}`
            : "Detail Transaksi"
        }
        footer={
          dipilih?.status === "completed" && !terkirim ? (
            konfirmasiVoid ? (
              <div className="flex w-full items-center justify-between gap-3">
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setKonfirmasiVoid(false)}
                >
                  Kembali
                </Button>
                <Button
                  variant="danger"
                  disabled={pending}
                  onClick={() => kirim(dipilih.id)}
                >
                  {pending ? "Mengirim..." : "Kirim Pengajuan"}
                </Button>
              </div>
            ) : (
              <Button
                variant="danger"
                fullWidth
                disabled={!adaShiftTerbuka || !alasan.trim() || alasan.trim().length < 3}
                title={
                  adaShiftTerbuka
                    ? undefined
                    : "Toko sedang tutup. Pembatalan harus lewat pemilik di /admin/void."
                }
                onClick={() => setKonfirmasiVoid(true)}
              >
                <Ban className="size-4" aria-hidden />
                Ajukan Pembatalan
              </Button>
            )
          ) : null
        }
      >
        {dipilih ? (
          <div className="flex flex-col gap-4">
            {dipilih.status === "void" ? (
              <p className="border-2 border-ink bg-danger p-3 text-sm font-semibold text-ink">
                Transaksi ini sudah dibatalkan. Stoknya sudah dikembalikan dan
                nilainya tidak dihitung di omzet.
              </p>
            ) : dipilih.status === "perlu_review" ? (
              <p className="border-2 border-ink bg-warning p-3 text-sm font-semibold text-ink">
                Pengajuan pembatalan transaksi ini dikirim dan sedang menunggu
                keputusan pemilik. Nilainya belum dihitung di omzet selama
                menunggu. Status akan berubah setelah disetujui atau ditolak.
              </p>
            ) : null}

            <ul className="flex flex-col divide-y divide-ink">
              {dipilih.transaction_items.map((i, idx) => (
                <li key={idx} className="flex items-start gap-3 py-2">
                  <span className="min-w-0 flex-1 text-sm">
                    {i.product_name_snapshot}
                    <span className="block text-xs text-text-secondary tabular-nums">
                      {formatUang(Number(i.price_snapshot))} × {i.qty}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatUang(Number(i.subtotal))}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex items-baseline justify-between border-t-2 border-ink pt-3">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold tabular-nums">
                {formatUang(Number(dipilih.total))}
              </span>
            </div>

            {dipilih.status === "completed" && !terkirim ? (
              konfirmasiVoid ? (
                <div className="flex flex-col gap-3">
                  <p className="border-2 border-ink bg-warning p-3 text-sm font-semibold text-ink">
                    Stok TIDAK dikembalikan sekarang. Pemilik akan meninjau
                    pengajuan ini — kalau disetujui, transaksi dibatalkan dan
                    stoknya kembali; kalau ditolak, transaksi tetap sah.
                    Catatannya tidak pernah dihapus.
                  </p>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">
                      Alasan pembatalan
                    </span>
                    <textarea
                      value={alasan}
                      onChange={(e) => setAlasan(e.target.value)}
                      rows={3}
                      placeholder="Misal: salah kasih pesanan, pelanggan protes rasanya..."
                      className="border-2 border-ink bg-surface px-3 py-2 text-base"
                    />
                    <span className="text-xs text-text-secondary">
                      Minimal 3 karakter. Alasan ini dilihat pemilik.
                    </span>
                  </label>
                </div>
              ) : (
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">Alasan pembatalan</span>
                  <textarea
                    value={alasan}
                    onChange={(e) => setAlasan(e.target.value)}
                    rows={3}
                    placeholder="Misal: salah kasih pesanan, pelanggan protes rasanya..."
                    className="border-2 border-ink bg-surface px-3 py-2 text-base"
                  />
                  <span className="text-xs text-text-secondary">
                    Minimal 3 karakter. Alasan ini dilihat pemilik.
                  </span>
                </label>
              )
            ) : null}

{terkirim ? (
              <p className="border-2 border-ink bg-success p-3 text-sm font-semibold text-ink">
                Pengajuan pembatalan terkirim. Pemilik akan menilai — stok
                tetap utuh sampai ada keputusan.
              </p>
            ) : null}

            {error ? (
              <p
                role="alert"
                className="flex items-start gap-2 border-2 border-ink bg-danger p-3 text-sm font-semibold text-ink"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}