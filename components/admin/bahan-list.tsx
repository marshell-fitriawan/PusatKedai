"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  History,
  PackagePlus,
  Pencil,
  Plus,
  Power,
} from "lucide-react";
import {
  koreksiStokBahan,
  riwayatBahan,
  setBahanActive,
  tambahStokBahan,
  type BarisRiwayat,
} from "@/app/admin/(dashboard)/bahan/actions";
import { BahanForm, type BarisBahan } from "@/components/admin/bahan-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatUang } from "@/lib/utils";

export type Baris = {
  id: string;
  name: string;
  satuan: string;
  harga_beli: number | null;
  is_active: boolean;
  quantity: number;
};

const tanggal = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function BahanList({
  baris,
  ambangMenipis,
  adaGudang,
}: {
  baris: Baris[];
  ambangMenipis: number;
  adaGudang: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BarisBahan | undefined>(undefined);

  // Modal tambah/koreksi stok
  const [stokUntuk, setStokUntuk] = useState<Baris | null>(null);
  const [modeTambah, setModeTambah] = useState(true);
  const [jumlah, setJumlah] = useState("");
  const [alasan, setAlasan] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [riwayatUntuk, setRiwayatUntuk] = useState<Baris | null>(null);
  const [riwayat, setRiwayat] = useState<BarisRiwayat[] | null>(null);

  const menipis = baris.filter(
    (b) => b.quantity > 0 && b.quantity <= ambangMenipis,
  ).length;
  const habis = baris.filter((b) => b.quantity <= 0).length;

  function openTambah() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openUbah(b: Baris) {
    setEditing({
      id: b.id,
      name: b.name,
      satuan: b.satuan,
      harga_beli: b.harga_beli,
    });
    setFormOpen(true);
  }

  function bukaStok(b: Baris, tambah: boolean) {
    setStokUntuk(b);
    setModeTambah(tambah);
    setJumlah("");
    setAlasan("");
    setError(null);
  }

  function simpanStok() {
    if (!stokUntuk) return;
    setError(null);

    const qty = Number(jumlah);
    startTransition(async () => {
      const res = modeTambah
        ? await tambahStokBahan(stokUntuk.id, qty, alasan)
        : await koreksiStokBahan(stokUntuk.id, qty, alasan);
      if (res.error) {
        setError(res.error);
        return;
      }
      setStokUntuk(null);
      router.refresh();
    });
  }

  function bukaRiwayat(b: Baris) {
    setRiwayatUntuk(b);
    setRiwayat(null);

    startTransition(async () => {
      const res = await riwayatBahan(b.id);
      setRiwayat(res.data ?? []);
    });
  }

  function toggleAktif(b: Baris) {
    startTransition(async () => {
      await setBahanActive(b.id, !b.is_active);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bahan Mentah</h1>
          <p className="text-sm text-text-secondary">
            {baris.length} bahan · {menipis} menipis · {habis} habis atau minus
          </p>
        </div>

        <Button onClick={openTambah}>
          <Plus className="size-4" aria-hidden />
          Tambah Bahan
        </Button>
      </div>

      {!adaGudang ? (
        <p
          role="alert"
          className="flex items-start gap-2 border-2 border-ink bg-warning p-3 text-sm font-semibold text-ink"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Belum ada gudang pusat — tandai satu kedai sebagai “Gudang pusat” di
          menu Kedai sebelum produksi.
        </p>
      ) : null}

      {baris.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-text-secondary">
            Belum ada bahan. Tambahkan bahan pertama untuk mulai mencatat stok
            mentah dan produksi.
          </p>
        </Card>
      ) : (
        <>
          {/* Mobile: kartu bertumpuk */}
          <div className="flex flex-col gap-3 lg:hidden">
            {baris.map((b) => (
              <Card key={b.id} className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{b.name}</p>
                    <p className="text-xs text-text-secondary">Satuan {b.satuan}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge
                      tone={
                        !b.is_active
                          ? "neutral"
                          : b.quantity <= 0
                            ? "danger"
                            : b.quantity <= ambangMenipis
                              ? "warning"
                              : "success"
                      }
                    >
                      {!b.is_active
                        ? "Nonaktif"
                        : b.quantity < 0
                          ? "Minus"
                          : b.quantity <= 0
                            ? "Habis"
                            : b.quantity <= ambangMenipis
                              ? "Menipis"
                              : "Aman"}
                    </Badge>
                    <p className="text-lg font-bold tabular-nums">{b.quantity}</p>
                  </div>
                </div>

                <dl className="border-2 border-ink bg-surface-alt p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-text-secondary">Harga beli per satuan</dt>
                    <dd className="tabular-nums">
                      {b.harga_beli != null ? formatUang(b.harga_beli) : "—"}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2 border-t-2 border-ink pt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!b.is_active}
                    onClick={() => bukaStok(b, true)}
                    aria-label={`Tambah stok ${b.name}`}
                  >
                    <PackagePlus className="size-4" aria-hidden />
                    Stok
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!b.is_active}
                    onClick={() => bukaStok(b, false)}
                    aria-label={`Koreksi stok ${b.name}`}
                  >
                    <Pencil className="size-4" aria-hidden />
                    Koreksi
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
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openUbah(b)}
                    aria-label={`Ubah ${b.name}`}
                  >
                    Ubah
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => toggleAktif(b)}
                    aria-label={`${b.is_active ? "Nonaktifkan" : "Aktifkan"} ${b.name}`}
                  >
                    <Power className="size-4" aria-hidden />
                    {b.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop: tabel */}
          <Card className="hidden p-0 lg:block">
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Bahan</TH>
                    <TH>Satuan</TH>
                    <TH numeric>Stok</TH>
                    <TH numeric>Harga beli/sat</TH>
                    <TH>Status</TH>
                    <TH>Aksi</TH>
                  </TR>
                </THead>
                <TBody>
                  {baris.map((b) => (
                    <TR key={b.id}>
                      <TD className="font-semibold">{b.name}</TD>
                      <TD className="text-text-secondary">{b.satuan}</TD>
                      <TD numeric>{b.quantity}</TD>
                      <TD numeric>
                        {b.harga_beli != null
                          ? formatUang(b.harga_beli)
                          : "—"}
                      </TD>
                      <TD>
                        {!b.is_active ? (
                          <Badge tone="neutral">Nonaktif</Badge>
                        ) : b.quantity <= 0 ? (
                          <Badge tone="danger">
                            {b.quantity < 0 ? "Minus" : "Habis"}
                          </Badge>
                        ) : b.quantity <= ambangMenipis ? (
                          <Badge tone="warning">Menipis</Badge>
                        ) : (
                          <Badge tone="success">Aman</Badge>
                        )}
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!b.is_active}
                            onClick={() => bukaStok(b, true)}
                            aria-label={`Tambah stok ${b.name}`}
                          >
                            <PackagePlus className="size-4" aria-hidden />
                            Stok
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!b.is_active}
                            onClick={() => bukaStok(b, false)}
                            aria-label={`Koreksi stok ${b.name}`}
                          >
                            <Pencil className="size-4" aria-hidden />
                            Koreksi
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
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openUbah(b)}
                            aria-label={`Ubah ${b.name}`}
                          >
                            Ubah
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => toggleAktif(b)}
                            aria-label={`${b.is_active ? "Nonaktifkan" : "Aktifkan"} ${b.name}`}
                          >
                            <Power className="size-4" aria-hidden />
                            {b.is_active ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </Card>
        </>
      )}

      <p className="text-xs text-text-secondary">
        Setiap penambahan atau koreksi stok bahan tercatat sebagai jejak,
        bersama saldo setelahnya — stok bahan tidak pernah diubah langsung.
      </p>

      {/* --- Tambah / ubah katalog bahan --- */}
      <BahanForm
        key={editing?.id ?? "baru"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        bahan={editing}
      />

      {/* --- Tambah / koreksi stok --- */}
      <Modal
        open={stokUntuk !== null}
        onClose={() => setStokUntuk(null)}
        title={`${modeTambah ? "Tambah Stok" : "Koreksi Stok"} — ${stokUntuk?.name ?? ""}`}
        footer={
          <div className="flex w-full justify-end gap-3">
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => setStokUntuk(null)}
            >
              Batal
            </Button>
            <Button
              disabled={
                pending ||
                jumlah.trim() === "" ||
                (!modeTambah && alasan.trim().length < 3)
              }
              onClick={simpanStok}
            >
              {pending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label={modeTambah ? "Jumlah ditambah" : "Jumlah stok sekarang"}
            numeric
            value={jumlah}
            onChange={(e) => setJumlah(e.target.value)}
            hint={`Stok saat ini: ${stokUntuk?.quantity ?? 0} ${stokUntuk?.satuan ?? ""}`}
            autoFocus
          />

          {!modeTambah ? (
            <Input
              label="Alasan koreksi"
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Stok opname bulanan"
              hint="Wajib — jejak audit kalau angka diperbaiki"
            />
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
            Belum ada pergerakan stok untuk bahan ini.
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
                  <span className="block text-sm font-semibold">{r.reason}</span>
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