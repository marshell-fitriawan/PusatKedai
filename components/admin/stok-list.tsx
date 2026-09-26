"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, History, Pencil } from "lucide-react";
import {
  riwayatStok,
  setStok,
  type BarisRiwayat,
} from "@/app/admin/(dashboard)/stok/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

type Kedai = { id: string; name: string; low_stock_threshold: number };

type Baris = {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  belumDiatur: boolean;
};

const tanggal = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const labelAlasan: Record<string, string> = {
  initial: "Stok awal",
  sale: "Penjualan",
  void: "Pembatalan",
  mutation_out: "Mutasi keluar",
  mutation_in: "Mutasi masuk",
  adjustment: "Penyesuaian",
};

export function StokList({
  daftarKedai,
  kedaiTerpilih,
  baris,
}: {
  daftarKedai: Kedai[];
  kedaiTerpilih: Kedai;
  baris: Baris[];
}) {
  const router = useRouter();
  const [edit, setEdit] = useState<Baris | null>(null);
  const [jumlah, setJumlah] = useState("");
  const [alasan, setAlasan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [riwayatUntuk, setRiwayatUntuk] = useState<Baris | null>(null);
  const [riwayat, setRiwayat] = useState<BarisRiwayat[] | null>(null);

  const menipis = baris.filter(
    (b) => b.quantity > 0 && b.quantity <= kedaiTerpilih.low_stock_threshold,
  ).length;
  const habis = baris.filter((b) => b.quantity <= 0).length;

  function bukaEdit(b: Baris) {
    setEdit(b);
    setJumlah(String(b.quantity));
    setAlasan("");
    setError(null);
  }

  function simpan() {
    if (!edit) return;
    setError(null);

    startTransition(async () => {
      const res = await setStok(
        kedaiTerpilih.id,
        edit.id,
        Number(jumlah),
        alasan,
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      setEdit(null);
      router.refresh();
    });
  }

  function bukaRiwayat(b: Baris) {
    setRiwayatUntuk(b);
    setRiwayat(null);

    startTransition(async () => {
      const res = await riwayatStok(kedaiTerpilih.id, b.id);
      setRiwayat(res.data ?? []);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Stok</h1>
        <p className="text-sm text-text-secondary">
          {baris.length} produk · {menipis} menipis · {habis} habis atau minus
        </p>
      </div>

      <div className="max-w-xs">
        <Select
          label="Kedai"
          value={kedaiTerpilih.id}
          onChange={(e) => router.push(`/admin/stok?kedai=${e.target.value}`)}
          options={daftarKedai.map((k) => ({ value: k.id, label: k.name }))}
          hint={`Ambang stok menipis: ${kedaiTerpilih.low_stock_threshold}`}
        />
      </div>

      <Card className="hidden p-0 lg:block">
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Produk</TH>
                <TH>Kategori</TH>
                <TH numeric>Stok</TH>
                <TH>Status</TH>
                <TH>Aksi</TH>
              </TR>
            </THead>
            <TBody>
              {baris.map((b) => (
                <TR key={b.id}>
                  <TD className="font-semibold">{b.name}</TD>
                  <TD className="text-text-secondary">{b.category ?? "—"}</TD>
                  <TD numeric>{b.quantity}</TD>
                  <TD>
                    {b.quantity <= 0 ? (
                      <Badge tone="danger">
                        {b.quantity < 0 ? "Minus" : "Habis"}
                      </Badge>
                    ) : b.quantity <= kedaiTerpilih.low_stock_threshold ? (
                      <Badge tone="warning">Menipis</Badge>
                    ) : (
                      <Badge tone="success">Aman</Badge>
                    )}
                    {b.belumDiatur ? (
                      <span className="ml-2 text-xs text-text-secondary">
                        belum diatur
                      </span>
                    ) : null}
                  </TD>
                  <TD>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => bukaEdit(b)}
                        aria-label={`Atur stok ${b.name}`}
                      >
                        <Pencil className="size-4" aria-hidden />
                        Atur
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => bukaRiwayat(b)}
                        aria-label={`Riwayat stok ${b.name}`}
                      >
                        <History className="size-4" aria-hidden />
                        Riwayat
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </Card>

      {/* Mobile: kartu bertumpuk */}
      <div className="flex flex-col gap-3 lg:hidden">
        {baris.map((b) => (
          <Card key={b.id} className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{b.name}</p>
                <p className="text-xs text-text-secondary">
                  {b.category ?? "Tanpa kategori"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <p className="text-lg font-bold tabular-nums">{b.quantity}</p>
                {b.quantity <= 0 ? (
                  <Badge tone="danger">
                    {b.quantity < 0 ? "Minus" : "Habis"}
                  </Badge>
                ) : b.quantity <= kedaiTerpilih.low_stock_threshold ? (
                  <Badge tone="warning">Menipis</Badge>
                ) : (
                  <Badge tone="success">Aman</Badge>
                )}
              </div>
            </div>
            {b.belumDiatur ? (
              <p className="text-xs text-text-secondary">
                Stok belum diatur untuk kedai ini.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 border-t-2 border-ink pt-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => bukaEdit(b)}
                aria-label={`Atur stok ${b.name}`}
              >
                <Pencil className="size-4" aria-hidden />
                Atur
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => bukaRiwayat(b)}
                aria-label={`Riwayat stok ${b.name}`}
              >
                <History className="size-4" aria-hidden />
                Riwayat
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <p className="text-xs text-text-secondary">
        Stok tidak pernah diubah langsung — setiap perubahan ada jejaknya
        dan alasannya. Stok boleh minus: kasir tetap bisa menjual saat catatan
        menunjukkan nol, karena perangkatnya bisa belum terkirim datanya dari
        yang lain.
      </p>

      {/* --- Atur stok --- */}
      <Modal
        open={edit !== null}
        onClose={() => setEdit(null)}
        title={edit ? `Atur Stok — ${edit.name}` : "Atur Stok"}
        footer={
          <div className="flex w-full justify-end gap-3">
            <Button variant="secondary" disabled={pending} onClick={() => setEdit(null)}>
              Batal
            </Button>
            <Button disabled={pending || alasan.trim().length < 3} onClick={simpan}>
              {pending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Jumlah stok sekarang"
            numeric
            value={jumlah}
            onChange={(e) => setJumlah(e.target.value)}
            hint={`Sebelumnya: ${edit?.quantity ?? 0}`}
            autoFocus
          />

          <Input
            label="Alasan"
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder="Stok opname bulanan"
            hint="Wajib diisi — ini yang bisa dibaca orang lain enam bulan lagi"
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

      {/* --- Riwayat pergerakan --- */}
      <Modal
        open={riwayatUntuk !== null}
        onClose={() => setRiwayatUntuk(null)}
        title={riwayatUntuk ? `Riwayat — ${riwayatUntuk.name}` : "Riwayat"}
      >
        {riwayat === null ? (
          <p className="text-sm text-text-secondary">Memuat...</p>
        ) : riwayat.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Belum ada pergerakan stok untuk produk ini di kedai tersebut.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-ink">
            {riwayat.map((r, i) => (
              <li key={i} className="flex items-start gap-3 py-2">
                <span
                  className={`w-14 shrink-0 text-right font-bold tabular-nums ${
                    r.delta > 0 ? "text-success-text" : "text-danger-text"
                  }`}
                >
                  {r.delta > 0 ? "+" : ""}
                  {r.delta}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {labelAlasan[r.reason] ?? r.reason}
                  </span>
                  <span className="block text-xs text-text-secondary">
                    {tanggal.format(new Date(r.created_at))} · saldo jadi{" "}
                    <span className="tabular-nums">{r.balance_after}</span>
                  </span>
                  {r.note ? (
                    <span className="block text-xs text-text-secondary italic">
                      {r.note}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
