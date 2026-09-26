"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ClipboardCheck } from "lucide-react";
import { simpanSisaFisik } from "@/app/pos/(kasir)/shift/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type BarisStok = {
  productId: string;
  name: string;
  quantity: number;
};

/**
 * Input hitungan fisik saat tutup (M7-2).
 *
 * Kasir menghitung sisa barang sungguhan lalu menyesuaikan angkanya; angka
 * ini jadi pembanding `selisih stok` di halaman Collect milik pemilik.
 * Nilai awal diisi stok tercatat supaya kasir tinggal mengubah yang beda
 * dari hitungannya -- kalau ternyata kosong/hilang, diisi 0.
 */
export function SisaFisikForm({
  shiftId,
  stok,
}: {
  shiftId: string;
  stok: BarisStok[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sukses, setSukses] = useState<string | null>(null);
  const [nilai, setNilai] = useState<Record<string, string>>(() =>
    Object.fromEntries(stok.map((s) => [s.productId, String(s.quantity)])),
  );

  function simpan() {
    setError(null);
    setSukses(null);

    const items = Object.entries(nilai)
      .filter(([id]) => stok.some((s) => s.productId === id))
      .map(([productId, v]) => ({
        productId,
        quantity: Number(v),
      }));

    startTransition(async () => {
      const res = await simpanSisaFisik(shiftId, items);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSukses("Hitungan fisik tersimpan.");
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ClipboardCheck className="size-5" aria-hidden />
          Hitung Fisik Sisa Stok
        </h2>
        <p className="text-sm text-text-secondary">
          Hitung sisa barang sungguhan di rak/laci, lalu sesuaikan angkanya.
          Selisih dengan catatan hanya dilihat pemilik.
        </p>
      </div>

      {stok.length === 0 ? (
        <p className="text-sm text-text-secondary">
          Tidak ada stok tercatat di kedai ini hari itu.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-ink">
          {stok.map((s) => (
            <li key={s.productId} className="flex items-end gap-3 py-2">
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{s.name}</span>
                <span className="block text-xs text-text-secondary">
                  Tercatat: {s.quantity}
                </span>
              </div>
              <div className="w-24">
                <Input
                  label="Sisa fisik"
                  numeric
                  inputMode="numeric"
                  value={nilai[s.productId] ?? ""}
                  onChange={(e) =>
                    setNilai((n) => ({
                      ...n,
                      [s.productId]: e.target.value,
                    }))
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}

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

      {stok.length > 0 ? (
        <div className="flex justify-end">
          <Button disabled={pending} onClick={simpan}>
            {pending ? "Menyimpan..." : "Simpan Hitungan"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}