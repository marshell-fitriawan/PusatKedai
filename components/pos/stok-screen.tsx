"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRightLeft, PackagePlus } from "lucide-react";
import { ajukanMutasi } from "@/app/pos/(kasir)/stok/actions";
import type { BarisMutasi, BarisStok } from "@/app/pos/(kasir)/stok/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";

const tanggal = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const labelStatus: Record<BarisMutasi["status"], string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
};

const toneStatus: Record<BarisMutasi["status"], "warning" | "success" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

export function StokScreen({
  kedai,
  baris,
  kedaiTujuan,
  mutasi,
}: {
  kedai: { name: string; low_stock_threshold: number };
  baris: BarisStok[];
  kedaiTujuan: { id: string; name: string }[];
  mutasi: BarisMutasi[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [toKedaiId, setToKedaiId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const menipis = baris.filter(
    (b) => b.quantity > 0 && b.quantity <= kedai.low_stock_threshold,
  ).length;
  const habis = baris.filter((b) => b.quantity <= 0).length;

  function bukaForm() {
    setProductId("");
    setToKedaiId("");
    setQuantity("");
    setNote("");
    setError(null);
    setOpen(true);
  }

  function kirim() {
    setError(null);
    startTransition(async () => {
      const res = await ajukanMutasi(productId, toKedaiId, Number(quantity), note);
      if (res.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const produkPilihan = baris.find((b) => b.product_id === productId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Stok {kedai.name}</h1>
          <p className="text-sm text-text-secondary">
            {baris.length} jenis · {menipis} menipis · {habis} habis atau minus
          </p>
        </div>
        <Button onClick={bukaForm} aria-label="Ajukan pindah stok">
          <ArrowRightLeft className="size-4" aria-hidden />
          Pindah Stok
        </Button>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <div className="flex flex-col divide-y divide-ink">
            {baris.length === 0 ? (
              <p className="p-4 text-sm text-text-secondary">
                Belum ada stok tercatat untuk kedai ini.
              </p>
            ) : (
              baris.map((b) => (
                <div key={b.product_id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {b.product?.name ?? "Produk terhapus"}
                    </p>
                    <p className="text-xs text-text-secondary">Tersedia di stok</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-lg font-bold tabular-nums">{b.quantity}</span>
                    {b.quantity <= 0 ? (
                      <Badge tone="danger">{b.quantity < 0 ? "Minus" : "Habis"}</Badge>
                    ) : b.quantity <= kedai.low_stock_threshold ? (
                      <Badge tone="warning">Menipis</Badge>
                    ) : (
                      <Badge tone="success">Aman</Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      <p className="text-xs text-text-secondary">
        Stok boleh minus: kasir tetap bisa menjual saat perangkat offline dengan
        data yang sudah basi. Pindah stok butuh persetujuan admin pusat.
      </p>

      {/* --- Riwayat mutasi keluar kedai ini --- */}
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Mutasi Keluar</h2>
        {mutasi.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Belum ada pengajuan pindah stok dari kedai ini.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {mutasi.map((m) => (
              <li key={m.id}>
                <Card className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {m.product?.name ?? "Produk terhapus"}
                      <span className="font-bold tabular-nums"> ×{m.quantity}</span>
                    </p>
                    <p className="text-xs text-text-secondary">
                      ke {m.tujuan?.name ?? "—"} · {tanggal.format(new Date(m.requested_at))}
                    </p>
                    {m.note ? (
                      <p className="truncate text-xs text-text-secondary italic">{m.note}</p>
                    ) : null}
                  </div>
                  <Badge tone={toneStatus[m.status]}>{labelStatus[m.status]}</Badge>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- Form ajukan mutasi --- */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Pindah Stok ke Kedai Lain"
        footer={
          <div className="flex w-full justify-end gap-3">
            <Button variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              disabled={pending || !productId || !toKedaiId || !quantity}
              onClick={kirim}
            >
              <PackagePlus className="size-4" aria-hidden />
              {pending ? "Mengajukan..." : "Ajukan"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Select
            label="Produk"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            options={baris.map((b) => ({
              value: b.product_id,
              label: `${b.product?.name ?? "?"} — stok ${b.quantity}`,
            }))}
            hint={
              produkPilihan
                ? `Stok saat ini: ${produkPilihan.quantity}`
                : undefined
            }
          />
          <Input
            label="Jumlah"
            numeric
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
          />
          <Select
            label="Ke kedai"
            value={toKedaiId}
            onChange={(e) => setToKedaiId(e.target.value)}
            options={kedaiTujuan.map((k) => ({ value: k.id, label: k.name }))}
          />
          <Input
            label="Catatan (opsional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Contoh: sebagian untuk dapur cabang Melati"
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
        </div>
      </Modal>
    </div>
  );
}