"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { catatProduksi } from "@/app/admin/(dashboard)/produksi/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export type Produk = { id: string; name: string; price: number | null };
export type Bahan = { id: string; name: string; satuan: string; stok: number };

type ItemBahan = { bahan_id: string; qty: number };

type Riwayat = {
  id: string;
  product_name: string;
  qty_hasil: number;
  produced_at: string;
  note: string | null;
  bahan: ItemBahan[];
};

const tanggal = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function ProduksiRun({
  produk,
  bahan,
  gudang,
  riwayat,
}: {
  produk: Produk[];
  bahan: Bahan[];
  gudang: { id: string; name: string } | null;
  riwayat: Riwayat[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sukses, setSukses] = useState<string | null>(null);

  const [productId, setProductId] = useState("");
  const [qtyHasil, setQtyHasil] = useState("");
  const [rows, setRows] = useState([{ bahanId: "", qty: "" }]);
  const [note, setNote] = useState("");

  const namaBahan = new Map(bahan.map((b) => [b.id, b]));

  function tambahBaris() {
    setRows((r) => [...r, { bahanId: "", qty: "" }]);
  }

  function ubahBaris(index: number, field: "bahanId" | "qty", value: string) {
    setRows((r) => r.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function hapusBaris(index: number) {
    setRows((r) => r.filter((_, i) => i !== index));
  }

  function simpan() {
    setError(null);
    setSukses(null);

    if (!productId) {
      setError("Pilih produk yang dihasilkan.");
      return;
    }

    const bahanTerpilih = rows
      .map((r) => ({ bahanId: r.bahanId, qty: Number(r.qty) }))
      .filter((r) => r.bahanId && r.qty > 0);

    if (bahanTerpilih.length !== rows.length) {
      setError("Lengkapi semua baris bahan dan pemakaiannya.");
      return;
    }

    startTransition(async () => {
      const res = await catatProduksi(
        productId,
        Number(qtyHasil),
        bahanTerpilih.map((r) => r.bahanId),
        bahanTerpilih.map((r) => r.qty),
        note,
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      setSukses(`${res.qty_hasil} porsi tercatat di ${gudang?.name ?? "gudang pusat"}.`);
      setRows([{ bahanId: "", qty: "" }]);
      setQtyHasil("");
      setNote("");
    });
  }

  const bahanOptions = bahan.map((b) => ({
    value: b.id,
    label: `${b.name} — stok ${b.stok} ${b.satuan}`,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Produksi</h1>
        <p className="text-sm text-text-secondary">
          Catat produksi manual: bahan mentah menjadi produk jadi di{" "}
          {gudang?.name ?? "gudang pusat"}
        </p>
      </div>

      {!gudang ? (
        <p
          role="alert"
          className="flex items-start gap-2 border-2 border-ink bg-warning p-3 text-sm font-semibold text-ink"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Belum ada gudang pusat — tandai satu kedai sebagai “Gudang pusat” di
          menu Kedai sebelum produksi.
        </p>
      ) : null}

      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <Select
                label="Produk yang dibuat"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                options={produk.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
            <div className="w-full sm:w-40">
              <Input
                label="Jumlah hasil"
                numeric
                value={qtyHasil}
                onChange={(e) => setQtyHasil(e.target.value)}
                placeholder="cth. 40"
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Bahan yang dipakai</span>
              <Button size="sm" variant="secondary" onClick={tambahBaris}>
                <Plus className="size-4" aria-hidden />
                Tambah bahan
              </Button>
            </div>

            {rows.map((row, i) => (
              <div key={i} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Select
                    label="Bahan"
                    value={row.bahanId}
                    onChange={(e) => ubahBaris(i, "bahanId", e.target.value)}
                    options={bahanOptions}
                  />
                </div>
                <div className="w-full sm:w-40">
                  <Input
                    label="Jumlah"
                    numeric
                    value={row.qty}
                    onChange={(e) => ubahBaris(i, "qty", e.target.value)}
                    placeholder="Jumlah"
                    inputMode="numeric"
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={rows.length === 1}
                  onClick={() => hapusBaris(i)}
                  aria-label={`Hapus baris bahan ${i + 1}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
          </div>

          <Input
            label="Catatan (opsional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="cth. racikan reguler ukuran besar"
          />

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 border-2 border-ink bg-danger p-3 text-sm font-semibold text-ink"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}

          {sukses ? (
            <p className="border-2 border-ink bg-success p-3 text-sm font-semibold text-ink">
              {sukses}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button
              disabled={
                pending ||
                !productId ||
                qtyHasil.trim() === "" ||
                rows.some((r) => !r.bahanId || Number(r.qty) <= 0)
              }
              onClick={simpan}
            >
              {pending ? "Mencatat..." : "Catat Produksi"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="hidden p-0 lg:block">
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Produk</TH>
                <TH numeric>Hasil</TH>
                <TH>Bahan dipakai</TH>
                <TH>Waktu</TH>
              </TR>
            </THead>
            <TBody>
              {riwayat.length === 0 ? (
                <TR>
                  <TD colSpan={4} className="text-center text-text-secondary">
                    Belum ada produksi tercatat.
                  </TD>
                </TR>
              ) : (
                riwayat.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-semibold">{r.product_name}</TD>
                    <TD numeric>{r.qty_hasil}</TD>
                    <TD className="text-text-secondary">
                      <ul className="flex flex-wrap gap-1">
                        {r.bahan.map((b) => {
                          const bahanBaris = namaBahan.get(b.bahan_id);
                          return (
                            <li key={b.bahan_id}>
                              <Badge tone="neutral">
                                {bahanBaris?.name ?? "?"} ×{b.qty}
                              </Badge>
                            </li>
                          );
                        })}
                      </ul>
                    </TD>
                    <TD className="text-text-secondary">
                      {tanggal.format(new Date(r.produced_at))}
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </Card>

      {/* Mobile: kartu bertumpuk */}
      <div className="flex flex-col gap-3 lg:hidden">
        {riwayat.length === 0 ? (
          <Card className="text-center">
            <p className="text-sm text-text-secondary">
              Belum ada produksi tercatat.
            </p>
          </Card>
        ) : (
          riwayat.map((r) => (
            <Card key={r.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{r.product_name}</p>
                <p className="shrink-0 text-sm font-bold tabular-nums">
                  {r.qty_hasil} porsi
                </p>
              </div>
              <div>
                <p className="text-xs text-text-secondary">Bahan dipakai</p>
                <ul className="mt-1 flex flex-wrap gap-1">
                  {r.bahan.map((b) => {
                    const bahanBaris = namaBahan.get(b.bahan_id);
                    return (
                      <li key={b.bahan_id}>
                        <Badge tone="neutral">
                          {bahanBaris?.name ?? "?"} ×{b.qty}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <p className="border-t-2 border-ink pt-2 text-xs text-text-secondary">
                {tanggal.format(new Date(r.produced_at))}
              </p>
            </Card>
          ))
        )}
      </div>

      <p className="text-xs text-text-secondary">
        Bahan dicek cukup dan dikurangi, hasil masuk stok gudang pusat — semua
        dalam satu transaksi. Kalau stok bahan kurang, produksi ditolak seluruhnya.
      </p>
    </div>
  );
}