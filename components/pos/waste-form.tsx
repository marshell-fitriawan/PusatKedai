"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Trash } from "lucide-react";
import { catatWaste } from "@/app/pos/(kasir)/shift/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export type OpsiStok = {
  productId: string;
  name: string;
  quantity: number;
};

/**
 * Catat stok hilang yang SAH (M7-3): rusak, tumpah, lewat masa simpan.
 * Alasan wajib; pemilik melihat semua waste di riwayat stok / Collect.
 */
export function WasteForm({ stok }: { stok: OpsiStok[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sukses, setSukses] = useState<string | null>(null);

  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [alasan, setAlasan] = useState("");

  function simpan() {
    setError(null);
    setSukses(null);

    startTransition(async () => {
      const res = await catatWaste(productId, Number(qty), alasan);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSukses("Waste tercatat, stok sudah dikurangi.");
      setProductId("");
      setQty("");
      setAlasan("");
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Trash className="size-5" aria-hidden />
          Stok Hilang (Waste)
        </h2>
        <p className="text-sm text-text-secondary">
          Catat barang rusak/tumpah/lewat masa simpan supaya tidak terhitung
          hilang curian.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <Select
            label="Produk"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            options={stok.map((s) => ({
              value: s.productId,
              label: `${s.name} — stok ${s.quantity}`,
            }))}
          />
        </div>
        <div className="w-full sm:w-28">
          <Input
            label="Jumlah"
            numeric
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="cth. 3"
          />
        </div>
      </div>

      <Input
        label="Alasan"
        value={alasan}
        onChange={(e) => setAlasan(e.target.value)}
        placeholder="cth. susu tumpah saat penyajian"
        hint="Wajib — jejak audit untuk pemilik"
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
          disabled={pending || !productId || qty.trim() === "" || alasan.trim().length < 3}
          onClick={simpan}
        >
          {pending ? "Mencatat..." : "Catat Waste"}
        </Button>
      </div>
    </Card>
  );
}