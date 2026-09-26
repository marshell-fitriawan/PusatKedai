"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Send } from "lucide-react";
import { assignDariGudang } from "@/app/admin/(dashboard)/mutasi/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export type StokGudang = {
  product_id: string;
  name: string;
  quantity: number;
};

export type KedaiTujuan = { id: string; name: string };

export function AssignGudang({
  gudang,
  stok,
  tujuan,
}: {
  gudang: { id: string; name: string } | null;
  stok: StokGudang[];
  tujuan: KedaiTujuan[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sukses, setSukses] = useState<string | null>(null);

  const [productId, setProductId] = useState("");
  const [toKedaiId, setToKedaiId] = useState("");
  const [qty, setQty] = useState("");

  function simpan() {
    if (!gudang) return;
    setError(null);
    setSukses(null);

    const jumlah = Number(qty);
    startTransition(async () => {
      const res = await assignDariGudang(gudang.id, toKedaiId, productId, jumlah);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSukses("Stok terassign & mutasi langsung disetujui.");
      setProductId("");
      setToKedaiId("");
      setQty("");
      router.refresh();
    });
  }

  if (!gudang) {
    return (
      <Card>
        <p
          role="alert"
          className="flex items-start gap-2 text-sm text-warning-text"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Belum ada gudang pusat — tandai satu kedai sebagai “Gudang pusat” di
          menu Kedai dulu.
        </p>
      </Card>
    );
  }

  const siap = productId !== "" && toKedaiId !== "" && Number(qty) > 0;

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Assign dari Gudang</h2>
          <p className="text-sm text-text-secondary">
            Kirim stok produk jadi dari <strong>{gudang.name}</strong> ke kedai.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <Select
              label="Produk"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              options={stok.map((s) => ({
                value: s.product_id,
                label: `${s.name} — stok ${s.quantity}`,
              }))}
            />
          </div>
          <div className="flex-1">
            <Select
              label="Kedai tujuan"
              value={toKedaiId}
              onChange={(e) => setToKedaiId(e.target.value)}
              options={tujuan.map((k) => ({ value: k.id, label: k.name }))}
            />
          </div>
          <div className="w-full sm:w-32">
            <Input
              label="Jumlah"
              numeric
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="cth. 12"
              inputMode="numeric"
            />
          </div>
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

        {sukses ? (
          <p className="border-2 border-ink bg-success p-3 text-sm font-semibold text-ink">
            {sukses}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button
            disabled={pending || !siap || stok.length === 0 || tujuan.length === 0}
            onClick={simpan}
          >
            <Send className="size-4" aria-hidden />
            {pending ? "Mengirim..." : "Assign"}
          </Button>
        </div>
      </div>
    </Card>
  );
}